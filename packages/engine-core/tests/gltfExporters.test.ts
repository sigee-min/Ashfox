import assert from 'node:assert/strict';

import validator from 'gltf-validator';
import { MeshoptDecoder } from 'meshoptimizer';

import {
  BlobResolutionError,
  ExportMaterializationRequiredError,
  buildGltf,
  sampleComposedNumericTransformChannel,
  type CompiledGltf,
  type TransformChannel,
  validateProjectDocument
} from '../src';
import {
  compileProjectBundleResolved
} from '../src/export/exportProject';
import {
  exportGltf
} from '../src/export/targets/gltf/exporter';
import {
  compressGltfWithMeshopt
} from '../src/export/targets/gltf/meshoptCompression';
import {
  composeMat4,
  IDENTITY_MAT4,
  multiplyMat4,
  type Mat4
} from '../src/export/targets/gltf/matrixMath';
import { createGltfProject } from './helpers';

const validationPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )
);

const registerAsyncTest = (promise: Promise<void>): void => {
  (
    globalThis as {
      __ashfoxEngineTestPromises: Promise<void>[];
    }
  ).__ashfoxEngineTestPromises.push(promise);
};

const assertValidatorReport = (report: {
  issues: {
    numErrors: number;
    numWarnings: number;
    messages: unknown[];
  };
}): void => {
  const messages = JSON.stringify(report.issues.messages, null, 2);
  assert.equal(report.issues.numErrors, 0, messages);
  assert.equal(report.issues.numWarnings, 0, messages);
};

const accessorComponentCount = (
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4'
): number => {
  switch (type) {
    case 'SCALAR':
      return 1;
    case 'VEC2':
      return 2;
    case 'VEC3':
      return 3;
    case 'VEC4':
      return 4;
    case 'MAT4':
      return 16;
  }
};

const readNumericAccessor = (
  compiled: CompiledGltf,
  accessorIndex: number
): number[] => {
  const accessor = compiled.document.accessors?.[accessorIndex];
  if (!accessor) throw new Error('Expected glTF accessor.');
  const bufferView = compiled.document.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error('Expected glTF buffer view.');
  const components = accessorComponentCount(accessor.type);
  const componentBytes = accessor.componentType === 5121
    ? 1
    : accessor.componentType === 5122 ||
    accessor.componentType === 5123
    ? 2
    : 4;
  const stride = bufferView.byteStride ?? components * componentBytes;
  const start = bufferView.byteOffset + (accessor.byteOffset ?? 0);
  const view = new DataView(
    compiled.binary.buffer,
    compiled.binary.byteOffset,
    compiled.binary.byteLength
  );
  const read = (offset: number): number => {
    if (accessor.componentType === 5121) {
      const value = view.getUint8(offset);
      return accessor.normalized ? value / 255 : value;
    }
    if (accessor.componentType === 5122) {
      const value = view.getInt16(offset, true);
      return accessor.normalized ? Math.max(value / 32767, -1) : value;
    }
    if (accessor.componentType === 5123) {
      const value = view.getUint16(offset, true);
      return accessor.normalized ? value / 65535 : value;
    }
    if (accessor.componentType === 5125) {
      return view.getUint32(offset, true);
    }
    return view.getFloat32(offset, true);
  };
  return Array.from(
    { length: accessor.count * components },
    (_, index) => {
      const element = Math.floor(index / components);
      const component = index % components;
      return read(start + element * stride + component * componentBytes);
    }
  );
};

const quaternionFromEuler = (
  rotation: readonly [number, number, number]
): readonly [number, number, number, number] => {
  const x = rotation[0] * Math.PI / 360;
  const y = rotation[1] * Math.PI / 360;
  const z = rotation[2] * Math.PI / 360;
  const sx = Math.sin(x);
  const cx = Math.cos(x);
  const sy = Math.sin(y);
  const cy = Math.cos(y);
  const sz = Math.sin(z);
  const cz = Math.cos(z);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
};

const assertArrayClose = (
  actual: readonly number[],
  expected: readonly number[],
  message: string,
  tolerance = 0.000001
): void => {
  assert.equal(actual.length, expected.length, message);
  expected.forEach((value, index) => {
    assert.ok(
      Math.abs((actual[index] ?? Number.NaN) - value) < tolerance,
      `${message}: component ${index}`
    );
  });
};

const mat4From = (values: readonly number[], offset = 0): Mat4 => [
  values[offset], values[offset + 1], values[offset + 2], values[offset + 3],
  values[offset + 4], values[offset + 5], values[offset + 6], values[offset + 7],
  values[offset + 8], values[offset + 9], values[offset + 10], values[offset + 11],
  values[offset + 12], values[offset + 13], values[offset + 14], values[offset + 15]
];

const globalNodeMatrices = (compiled: CompiledGltf): ReadonlyMap<number, Mat4> => {
  const parentByNode = new Map<number, number>();
  compiled.document.nodes.forEach((node, parent) => {
    node.children?.forEach((child) => parentByNode.set(child, parent));
  });
  const result = new Map<number, Mat4>();
  const resolve = (index: number): Mat4 => {
    const existing = result.get(index);
    if (existing) return existing;
    const node = compiled.document.nodes[index];
    const local = composeMat4(
      node.translation ?? [0, 0, 0],
      node.rotation ?? [0, 0, 0, 1],
      node.scale ?? [1, 1, 1]
    );
    const parent = parentByNode.get(index);
    const global = multiplyMat4(
      parent === undefined ? IDENTITY_MAT4 : resolve(parent),
      local
    );
    result.set(index, global);
    return global;
  };
  compiled.document.nodes.forEach((_, index) => resolve(index));
  return result;
};

{
  const project = createGltfProject('gltf');
  const compiled = buildGltf(project);
  assert.equal(compiled.document.asset.version, '2.0');
  assert.equal(compiled.document.buffers?.[0]?.uri, 'ashfox_crate.bin');
  assert.equal(compiled.document.meshes?.length, 1);
  assert.equal(compiled.document.animations?.[0]?.channels.length, 1);
  assert.ok(compiled.binary.byteLength > 0);

  const bundle = exportGltf(project);
  assert.deepEqual(bundle.entrypoints, ['ashfox_crate.gltf']);
  assert.equal(bundle.files[0]?.kind, 'json');
  assert.equal(bundle.files[0]?.contentType, 'model/gltf+json');
  assert.equal(bundle.files[1]?.kind, 'binary');
  assert.equal(bundle.files[1]?.path, 'ashfox_crate.bin');
  assert.equal(bundle.files[2]?.kind, 'blob-copy');
  const modelFile = bundle.files[0];
  const bufferFile = bundle.files[1];
  if (modelFile?.kind !== 'json' || bufferFile?.kind !== 'binary') {
    throw new Error('glTF validation artifacts missing');
  }
  registerAsyncTest(
    validator
      .validateBytes(Uint8Array.from(Buffer.from(modelFile.text)), {
        uri: 'ashfox_crate.gltf',
        format: 'gltf',
        externalResourceFunction: async (uri) =>
          uri.endsWith('.bin') ? bufferFile.data : validationPng
      })
      .then(assertValidatorReport)
  );
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('Cube fixture is missing.');
  project.scene = {
    ...project.scene,
    nodes: {
      ...project.scene.nodes,
      'cube-second': {
        ...cube,
        id: 'cube-second',
        name: 'second',
        transform: {
          ...cube.transform,
          position: [8, 0, 0]
        }
      }
    }
  };

  const compiled = buildGltf(project);
  const root = compiled.document.nodes.find(
    (node) => node.extras?.ashfoxId === 'bone-root'
  );
  const sourceCubes = compiled.document.nodes.filter(
    (node) => node.extras?.ashfoxKind === 'cube'
  );
  assert.equal(compiled.document.meshes?.length, 1);
  assert.equal(compiled.document.meshes?.[0].primitives.length, 1);
  assert.equal(typeof root?.mesh, 'number');
  assert.equal(compiled.document.skins, undefined);
  assert.ok(sourceCubes.every((node) => node.mesh === undefined));
  const primitive = compiled.document.meshes?.[0].primitives[0];
  if (!primitive || primitive.indices === undefined) {
    throw new Error('Rigid batch primitive is missing.');
  }
  assert.equal(compiled.document.accessors?.[primitive.indices].count, 72);
  const position = compiled.document.accessors?.[
    primitive.attributes.POSITION
  ];
  const normal = primitive.attributes.NORMAL === undefined
    ? undefined
    : compiled.document.accessors?.[primitive.attributes.NORMAL];
  const uv = primitive.attributes.TEXCOORD_0 === undefined
    ? undefined
    : compiled.document.accessors?.[primitive.attributes.TEXCOORD_0];
  assert.equal(position?.componentType, 5122);
  assert.equal(position?.normalized, true);
  assert.equal(normal?.componentType, 5122);
  assert.equal(normal?.normalized, true);
  assert.equal(uv?.componentType, 5123);
  assert.equal(uv?.normalized, true);
  assert.equal(primitive.attributes.JOINTS_0, undefined);
  assert.equal(primitive.attributes.WEIGHTS_0, undefined);
  assert.deepEqual(compiled.document.extensionsRequired, [
    'KHR_mesh_quantization'
  ]);
  const positions = readNumericAccessor(
    compiled,
    primitive.attributes.POSITION
  );
  assert.ok(positions.every(Number.isFinite));
  assert.ok(positions.every((value) => Math.abs(value) <= 1));
  assert.ok(Math.max(...positions.map(Math.abs)) > 0.5);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const root = project.scene.nodes['bone-root'];
  const cube = project.scene.nodes['cube-body'];
  if (root.kind !== 'bone' || cube.kind !== 'cube') {
    throw new Error('Static global batch fixture nodes are missing.');
  }
  project.animations = {};
  project.scene = {
    roots: [...project.scene.roots, 'bone-static-second'],
    nodes: {
      ...project.scene.nodes,
      'bone-static-second': {
        ...root,
        id: 'bone-static-second',
        name: 'static second',
        transform: {
          ...root.transform,
          position: [32, 0, 0]
        }
      },
      'cube-static-second': {
        ...cube,
        id: 'cube-static-second',
        name: 'static second cube',
        parentId: 'bone-static-second'
      }
    }
  };
  const compiled = buildGltf(project);
  const optimizedNode = compiled.document.nodes.find(
    (node) => node.name === `${project.name} optimized mesh`
  );
  assert.equal(compiled.document.meshes?.length, 1);
  assert.equal(compiled.document.meshes?.[0].primitives.length, 1);
  assert.equal(compiled.document.skins, undefined);
  assert.equal(optimizedNode?.mesh, 0);
  assert.equal(optimizedNode?.skin, undefined);
  assert.ok(optimizedNode?.translation?.every(Number.isFinite));
  assert.ok(optimizedNode?.scale?.every((value) => value > 0));
  assert.ok(
    compiled.document.nodes
      .filter((node) => node.extras?.ashfoxId !== undefined)
      .every((node) => node.mesh === undefined)
  );
  const primitive = compiled.document.meshes?.[0].primitives[0];
  assert.equal(primitive?.attributes.JOINTS_0, undefined);
  assert.equal(primitive?.attributes.WEIGHTS_0, undefined);

  const distant = project.scene.nodes['cube-static-second'];
  if (distant.kind !== 'cube') {
    throw new Error('Static precision fixture cube is missing.');
  }
  distant.transform = {
    ...distant.transform,
    position: [1_048_576, 0, 0]
  };
  const precise = buildGltf(project);
  const preciseNode = precise.document.nodes.find(
    (node) => node.name === `${project.name} optimized mesh`
  );
  const precisePrimitive = precise.document.meshes?.[0].primitives[0];
  const precisePosition = precisePrimitive === undefined
    ? undefined
    : precise.document.accessors?.[precisePrimitive.attributes.POSITION];
  assert.equal(preciseNode?.translation, undefined);
  assert.equal(preciseNode?.scale, undefined);
  assert.equal(precisePosition?.componentType, 5126);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const root = project.scene.nodes['bone-root'];
  const cube = project.scene.nodes['cube-body'];
  if (root.kind !== 'bone' || cube.kind !== 'cube') {
    throw new Error('Animated multi-root fixture nodes are missing.');
  }
  project.scene = {
    roots: [...project.scene.roots, 'bone-animated-second'],
    nodes: {
      ...project.scene.nodes,
      'bone-animated-second': {
        ...root,
        id: 'bone-animated-second',
        name: 'animated second root',
        transform: {
          ...root.transform,
          position: [32, 0, 0]
        }
      },
      'cube-animated-second': {
        ...cube,
        id: 'cube-animated-second',
        name: 'animated second cube',
        parentId: 'bone-animated-second'
      }
    }
  };
  const compiled = buildGltf(project);
  const skin = compiled.document.skins?.[0];
  assert.notEqual(skin?.skeleton, undefined);
  const commonRoot = skin?.skeleton === undefined
    ? undefined
    : compiled.document.nodes[skin.skeleton];
  assert.equal(commonRoot?.name, `${project.name} common rig root`);
  assert.equal(compiled.document.scenes[0].nodes.length, 2);
  assert.equal(compiled.document.scenes[0].nodes[0], skin?.skeleton);
  assert.equal(
    compiled.document.nodes[compiled.document.scenes[0].nodes[1]].skin,
    0
  );
  assert.ok(
    skin?.joints.every((joint) => commonRoot?.children?.includes(joint) ||
      compiled.document.nodes.some((node) => node.children?.includes(joint)))
  );
  registerAsyncTest(
    validator.validateBytes(
      new TextEncoder().encode(JSON.stringify(compiled.document)),
      {
        uri: 'animated-multi-root.gltf',
        format: 'gltf',
        externalResourceFunction: async (uri) =>
          uri.endsWith('.bin') ? compiled.binary : validationPng
      }
    ).then(assertValidatorReport)
  );
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const source = project.scene.nodes['cube-body'];
  if (source.kind !== 'cube') throw new Error('Cube fixture is missing.');
  project.textures['texture-base'] = {
    ...project.textures['texture-base'],
    atlasMode: 'generate',
    raster: { background: '#ffffff', canvasDetails: [] }
  };
  const first = {
    ...source,
    boxUv: false,
    transform: {
      ...source.transform,
      rotation: [0, 0, 0] as [number, number, number],
      pivot: [0, 0, 0] as [number, number, number]
    },
    bounds: { from: [0, 0, 0], to: [1, 1, 1] }
  };
  project.scene.nodes = {
    ...project.scene.nodes,
    'cube-body': first,
    'cube-adjacent': {
      ...first,
      id: 'cube-adjacent',
      name: 'adjacent',
      bounds: { from: [1, 0, 0], to: [2, 1, 1] }
    }
  };
  const compiled = buildGltf(project);
  const primitive = compiled.document.meshes?.[0]?.primitives[0];
  const indices = primitive?.indices === undefined
    ? undefined
    : compiled.document.accessors?.[primitive.indices];
  assert.equal(indices?.count, 60);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('Cube fixture is missing.');
  project.scene = {
    ...project.scene,
    nodes: {
      ...project.scene.nodes,
      'cube-animated': {
        ...cube,
        id: 'cube-animated',
        name: 'animated cube',
        transform: {
          ...cube.transform,
          position: [8, 0, 0]
        }
      }
    }
  };
  const source = project.animations['clip-idle']
    .channels['channel-root-rotation'];
  project.animations['clip-idle'].channels['channel-cube-rotation'] = {
    ...source,
    id: 'channel-cube-rotation',
    targetNodeId: 'cube-animated'
  };

  const compiled = buildGltf(project);
  const animatedCubeIndex = compiled.document.nodes.findIndex(
    (node) => node.extras?.ashfoxId === 'cube-animated'
  );
  assert.equal(compiled.document.meshes?.length, 1);
  assert.notEqual(animatedCubeIndex, -1);
  assert.equal(
    compiled.document.nodes[animatedCubeIndex]?.mesh,
    undefined
  );
  assert.equal(
    typeof compiled.document.nodes.find((node) => node.skin !== undefined)?.mesh,
    'number'
  );
  assert.ok(compiled.document.skins?.[0].joints.includes(animatedCubeIndex));
  const skin = compiled.document.skins?.[0];
  if (skin?.inverseBindMatrices === undefined) {
    throw new Error('Rigid skin inverse bind matrices are missing.');
  }
  const inverseBinds = readNumericAccessor(compiled, skin.inverseBindMatrices);
  const globals = globalNodeMatrices(compiled);
  const decodeMatrices = skin.joints.map((joint, index) =>
    multiplyMat4(
      globals.get(joint) ?? IDENTITY_MAT4,
      mat4From(inverseBinds, index * 16)
    )
  );
  for (const matrix of decodeMatrices.slice(1)) {
    assertArrayClose(matrix, decodeMatrices[0], 'skin bind-pose decode', 0.00001);
  }
  assert.ok(
    compiled.document.animations?.[0].channels.some(
      (channel) => channel.target.node === animatedCubeIndex
    )
  );
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('Cube fixture is missing.');
  project.scene = {
    ...project.scene,
    nodes: {
      ...project.scene.nodes,
      ...Object.fromEntries(Array.from({ length: 24 }, (_, index) => [
        `cube-batch-${index}`,
        {
          ...cube,
          id: `cube-batch-${index}`,
          name: `batch ${index}`,
          transform: {
            ...cube.transform,
            position: [index % 6, Math.floor(index / 6), 0]
          }
        }
      ]))
    }
  };
  registerAsyncTest((async () => {
    const raw = buildGltf(project);
    const compressed = await compressGltfWithMeshopt(raw);
    await MeshoptDecoder.ready;
    assert.ok(compressed.binary.byteLength < raw.binary.byteLength);
    assert.ok(
      compressed.document.extensionsRequired?.includes(
        'EXT_meshopt_compression'
      )
    );
    let decodedViews = 0;
    compressed.document.bufferViews?.forEach((view, index) => {
      const extension = view.extensions?.EXT_meshopt_compression;
      if (!extension) return;
      const decoded = new Uint8Array(view.byteLength);
      MeshoptDecoder.decodeGltfBuffer(
        decoded,
        extension.count,
        extension.byteStride,
        compressed.binary.subarray(
          extension.byteOffset,
          extension.byteOffset + extension.byteLength
        ),
        extension.mode,
        extension.filter
      );
      assert.equal(decoded.byteLength, view.byteLength);
      assert.ok(decoded.some((byte) => byte !== 0));
      decodedViews += 1;
    });
    assert.ok(decodedViews > 0);
    const report = await validator.validateBytes(
      new TextEncoder().encode(JSON.stringify(compressed.document)),
      {
        uri: 'ashfox_crate.gltf',
        format: 'gltf',
        externalResourceFunction: async (uri) =>
          uri.endsWith('.bin') ? compressed.binary : validationPng
      }
    );
    assertValidatorReport(report);
  })());
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const clip = project.animations['clip-idle'];
  project.animations = {
    ...project.animations,
    [clip.id]: {
      ...clip,
      startDelay: { kind: 'molang', source: '0.25' },
      loopDelay: { kind: 'molang', source: '0.5' },
      animationTimeUpdate: {
        kind: 'molang',
        source: 'query.anim_time'
      },
      blendWeight: 0.5,
      overridePreviousAnimation: true,
      triggers: {
        'trigger-sound': {
          id: 'trigger-sound',
          type: 'sound',
          keys: [{
            id: 'key-sound',
            timeSeconds: 0.25,
            value: { effect: 'ashfox:chime' }
          }]
        },
        'trigger-particle': {
          id: 'trigger-particle',
          type: 'particle',
          keys: [{
            id: 'key-particle-safe-omit',
            timeSeconds: 0.5,
            value: { effect: 'ashfox:spark' }
          }]
        },
        'trigger-timeline': {
          id: 'trigger-timeline',
          type: 'timeline',
          keys: [{
            id: 'key-timeline-safe-omit',
            timeSeconds: 0.75,
            value: 'variable.phase = 1;'
          }]
        }
      }
    }
  };
  const authoredProject = structuredClone(project);
  assert.equal(validateProjectDocument(project).valid, true);

  const bundle = exportGltf(project);
  assert.deepEqual(project, authoredProject);
  assert.deepEqual(
    new Set(bundle.adaptations.omitted.map(({ code }) => code)),
    new Set([
      'start_delay',
      'loop_delay',
      'animation_time_update',
      'blend_weight',
      'override_previous_animation',
      'sound_trigger',
      'particle_trigger',
      'timeline_trigger'
    ])
  );
  assert.deepEqual(bundle.adaptations.converted, []);
  for (const adaptation of bundle.adaptations.omitted) {
    assert.ok(adaptation.path.length > 0);
    assert.ok(adaptation.message.length > 0);
  }
  const model = bundle.files[0];
  if (model?.kind !== 'json') {
    throw new Error('Expected a glTF model artifact.');
  }
  const gltf = model.data as {
    animations?: Array<{ channels: unknown[] }>;
  };
  assert.equal(
    gltf.animations?.[0]?.channels.length,
    1,
    'safe event and playback omissions must preserve numeric node animation'
  );
}

{
  const bundle = exportGltf(createGltfProject('glb'));
  const model = bundle.files[0];
  assert.equal(model?.kind, 'binary');
  if (model?.kind !== 'binary') throw new Error('GLB model artifact missing');
  const view = new DataView(
    model.data.buffer,
    model.data.byteOffset,
    model.data.byteLength
  );
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), model.data.byteLength);
  const jsonLength = view.getUint32(12, true);
  assert.equal(view.getUint32(16, true), 0x4e4f534a);
  const jsonBytes = model.data.subarray(20, 20 + jsonLength);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes).trimEnd()) as {
    buffers?: Array<{ uri?: string }>;
    animations?: Array<{ extras?: { ashfoxLoop?: string } }>;
  };
  assert.equal(json.buffers?.[0]?.uri, undefined);
  assert.equal(json.animations?.[0]?.extras?.ashfoxLoop, 'loop');
  const binaryChunkOffset = 20 + jsonLength;
  assert.equal(view.getUint32(binaryChunkOffset + 4, true), 0x004e4942);
  assert.equal(bundle.files[1]?.kind, 'blob-copy');

  registerAsyncTest(
    validator
      .validateBytes(model.data, {
        uri: 'ashfox_crate.glb',
        format: 'glb',
        externalResourceFunction: async () => validationPng
      })
      .then(assertValidatorReport)
  );
}

{
  const project = createGltfProject('glb', 'embedded');
  project.textures['texture-base'].source.byteLength =
    validationPng.byteLength;
  assert.throws(
    () => exportGltf(project),
    ExportMaterializationRequiredError
  );

  registerAsyncTest(
    (async () => {
      let resolutionCount = 0;
      const bundle = await compileProjectBundleResolved(project, {
        resolveBlob: async (source) => {
          resolutionCount += 1;
          assert.equal(source.key, 'project-crate/ashfox_crate.png');
          return {
            bytes: validationPng,
            contentType: 'image/png'
          };
        }
      });
      assert.equal(resolutionCount, 1);
      assert.deepEqual(bundle.entrypoints, ['ashfox_crate.glb']);
      assert.equal(bundle.files.length, 1);
      const model = bundle.files[0];
      assert.equal(model?.kind, 'binary');
      if (model?.kind !== 'binary') {
        throw new Error('Embedded GLB model artifact missing');
      }

      const view = new DataView(
        model.data.buffer,
        model.data.byteOffset,
        model.data.byteLength
      );
      const jsonLength = view.getUint32(12, true);
      const jsonBytes = model.data.subarray(20, 20 + jsonLength);
      const json = JSON.parse(
        new TextDecoder().decode(jsonBytes).trimEnd()
      ) as {
        images?: Array<{
          uri?: string;
          bufferView?: number;
          mimeType?: string;
        }>;
        bufferViews?: Array<{
          byteOffset?: number;
          byteLength: number;
        }>;
      };
      const image = json.images?.[0];
      assert.equal(image?.uri, undefined);
      assert.equal(image?.mimeType, 'image/png');
      assert.equal(typeof image?.bufferView, 'number');
      const imageBufferView =
        image?.bufferView === undefined
          ? undefined
          : json.bufferViews?.[image.bufferView];
      assert.equal(imageBufferView?.byteLength, validationPng.byteLength);

      const binaryChunkOffset = 20 + jsonLength;
      assert.equal(
        view.getUint32(binaryChunkOffset + 4, true),
        0x004e4942
      );
      const imageOffset =
        binaryChunkOffset + 8 + (imageBufferView?.byteOffset ?? 0);
      const embeddedImage = model.data.subarray(
        imageOffset,
        imageOffset + (imageBufferView?.byteLength ?? 0)
      );
      assert.deepEqual(embeddedImage, validationPng);

      const report = await validator.validateBytes(model.data, {
        uri: 'ashfox_crate.glb',
        format: 'glb'
      });
      assertValidatorReport(report);
    })()
  );
}

{
  const invalidProfile = createGltfProject('gltf', 'embedded');
  const report = validateProjectDocument(invalidProfile);
  assert.equal(report.valid, false);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.path === 'formatProfile.imageStorage' &&
        finding.message.includes('GLB')
    )
  );
}

{
  const project = createGltfProject('glb', 'embedded');
  registerAsyncTest(
    compileProjectBundleResolved(project, {
      resolveBlob: async () => null
    }).then(
      () => {
        throw new Error('Missing embedded texture should fail export');
      },
      (error: unknown) => {
        assert.ok(error instanceof BlobResolutionError);
        assert.equal(error.code, 'blob.not_found');
        assert.equal(error.assetId, 'texture-base');
      }
    )
  );
}

{
  const project = createGltfProject('glb', 'embedded');
  project.textures['texture-base'].source.byteLength =
    validationPng.byteLength;
  registerAsyncTest(
    compileProjectBundleResolved(project, {
      resolveBlob: async () => ({
        bytes: validationPng,
        contentType: 'image/jpeg'
      })
    }).then(
      () => {
        throw new Error('Texture content-type mismatch should fail export');
      },
      (error: unknown) => {
        assert.ok(error instanceof BlobResolutionError);
        assert.equal(error.code, 'blob.content_type_mismatch');
      }
    )
  );
}

{
  const project = createGltfProject('glb', 'embedded');
  registerAsyncTest(
    compileProjectBundleResolved(project, {
      resolveBlob: async () => ({
        bytes: validationPng,
        contentType: 'image/png'
      })
    }).then(
      () => {
        throw new Error('Texture byte-length mismatch should fail export');
      },
      (error: unknown) => {
        assert.ok(error instanceof BlobResolutionError);
        assert.equal(error.code, 'blob.byte_length_mismatch');
      }
    )
  );
}

{
  const project = createGltfProject('gltf');
  project.formatProfile = {
    id: 'gltf.2',
    version: '2.0',
    container: 'gltf',
    imageStorage: 'external',
    modelPath: 'models/ashfox_crate'
  };
  const compiled = buildGltf(project);
  assert.equal(compiled.document.buffers?.[0]?.uri, 'ashfox_crate.bin');
  assert.equal(
    compiled.textureFiles[0]?.path,
    'models/textures/texture_0.png'
  );
  const bundle = exportGltf(project);
  assert.equal(bundle.files[0]?.path, 'models/ashfox_crate.gltf');
  assert.equal(bundle.files[1]?.path, 'models/ashfox_crate.bin');
}

{
  const project = structuredClone(createGltfProject('gltf'));
  (project.scene.roots as string[]).push('mesh-concave');
  (project.scene.nodes as Record<string, object>)['mesh-concave'] = {
    id: 'mesh-concave',
    kind: 'mesh',
    name: 'concave',
    parentId: null,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      pivot: [0, 0, 0]
    },
    visible: true,
    vertices: {
      a: { id: 'a', position: [0, 0, 0] },
      b: { id: 'b', position: [2, 0, 0] },
      c: { id: 'c', position: [1, 0, 1] },
      d: { id: 'd', position: [2, 0, 2] },
      e: { id: 'e', position: [0, 0, 2] }
    },
    faces: {
      polygon: {
        id: 'polygon',
        vertexIds: ['a', 'b', 'c', 'd', 'e'],
        uv: {},
        textureId: null
      }
    }
  };
  const compiled = buildGltf(project);
  const primitive = compiled.document.meshes?.[0]?.primitives.find(
    (candidate) => candidate.material === undefined
  );
  const indexAccessor =
    primitive?.indices === undefined
      ? undefined
      : compiled.document.accessors?.[primitive.indices];
  assert.equal(indexAccessor?.count, 9);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const root = project.scene.nodes['bone-root'];
  const cube = project.scene.nodes['cube-body'];
  const locator = project.scene.nodes['locator-effect'];
  if (
    root.kind !== 'bone' ||
    cube.kind !== 'cube' ||
    locator.kind !== 'locator'
  ) {
    throw new Error('visibility fixture nodes missing');
  }
  project.scene = {
    ...project.scene,
    nodes: {
      ...project.scene.nodes,
      'bone-hidden': {
        ...root,
        id: 'bone-hidden',
        name: 'hidden',
        parentId: 'bone-root',
        visible: false
      },
      'cube-body': {
        ...cube,
        parentId: 'bone-hidden',
        visible: true
      },
      'locator-effect': {
        ...locator,
        parentId: 'bone-hidden',
        visible: true
      }
    }
  };
  const clip = project.animations['clip-idle'];
  const channel = clip.channels['channel-root-rotation'];
  project.animations = {
    ...project.animations,
    'clip-idle': {
      ...clip,
      channels: {
        'channel-root-rotation': {
          ...channel,
          targetNodeId: 'bone-hidden'
        }
      }
    }
  };

  const compiled = buildGltf(project);
  assert.deepEqual(
    compiled.document.nodes.map(
      (node) => node.extras?.ashfoxId
    ),
    ['bone-root']
  );
  assert.equal(compiled.document.nodes[0].children, undefined);
  assert.equal(compiled.document.meshes, undefined);
  assert.equal(compiled.document.animations, undefined);
  assert.deepEqual(compiled.document.scenes[0].nodes, [0]);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const channel = project.animations['clip-idle']
    .channels['channel-root-rotation'];
  (channel.keys[0] as {
    value: readonly [number, number, number];
  }).value = [0, 0, 0];
  (channel.keys[1] as {
    value: readonly [number, number, number];
  }).value = [90, 90, 0];
  const compiled = buildGltf(project);
  const animation = compiled.document.animations?.[0];
  const rotationChannel = animation?.channels.find(
    (entry) => entry.target.path === 'rotation'
  );
  if (!animation || !rotationChannel) {
    throw new Error('Expected a glTF rotation channel.');
  }
  const sampler =
    animation.samplers[rotationChannel.sampler];
  const input =
    compiled.document.accessors?.[sampler.input];
  assert.equal(input?.count, 21);
  const output = readNumericAccessor(
    compiled,
    sampler.output
  );
  assertArrayClose(
    output.slice(10 * 4, 11 * 4),
    quaternionFromEuler([45, 45, 0]),
    'glTF rotation baking must sample the same 20 fps Euler pose as live preview',
    0.00005
  );
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const channel = project.animations['clip-idle']
    .channels['channel-root-rotation'];
  (channel.keys[0] as { timeSeconds: number }).timeSeconds = 0.5;
  const compiled = buildGltf(project);
  const sampler = compiled.document.animations?.[0]?.samplers[0];
  const inputAccessor =
    sampler === undefined
      ? undefined
      : compiled.document.accessors?.[sampler.input];
  assert.equal(inputAccessor?.count, 3);
  assert.deepEqual(inputAccessor?.min, [0]);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const clip = project.animations['clip-idle'];
  (clip as { durationSeconds: number }).durationSeconds = 2;
  const compiled = buildGltf(project);
  const sampler = compiled.document.animations?.[0]?.samplers[0];
  const inputAccessor =
    sampler === undefined
      ? undefined
      : compiled.document.accessors?.[sampler.input];
  assert.equal(inputAccessor?.count, 3);
  assert.deepEqual(inputAccessor?.max, [2]);
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const root = project.scene.nodes['bone-root'];
  root.transform = {
    position: [4, 8, 12],
    rotation: [10, 20, 30],
    scale: [2, 3, 4],
    pivot: [0, 0, 0]
  };
  const animationValues = {
    position: [1, 2, 3],
    rotation: [4, 5, 6],
    scale: [1.5, 0.5, 2]
  } as const;
  const createChannel = (
    property: TransformChannel['property']
  ): TransformChannel => ({
    id: `channel-root-${property}`,
    targetNodeId: 'bone-root',
    property,
    keys: [0, 1].map((timeSeconds) => ({
      id: `key-${property}-${timeSeconds}`,
      timeSeconds,
      value: animationValues[property],
      interpolation: 'linear'
    }))
  });
  const channels = {
    'channel-root-position': createChannel('position'),
    'channel-root-rotation': createChannel('rotation'),
    'channel-root-scale': createChannel('scale')
  };
  project.animations['clip-idle'].channels = channels;

  const compiled = buildGltf(project);
  const animation = compiled.document.animations?.[0];
  if (!animation) throw new Error('Expected glTF animation.');
  const outputFor = (
    path: 'translation' | 'rotation' | 'scale'
  ): number[] => {
    const channel = animation.channels.find(
      (entry) => entry.target.path === path
    );
    if (!channel) throw new Error(`Expected ${path} channel.`);
    return readNumericAccessor(
      compiled,
      animation.samplers[channel.sampler].output
    );
  };

  assertArrayClose(
    outputFor('translation').slice(0, 3),
    [5 / 16, 10 / 16, 15 / 16],
    'glTF translation must add a scaled delta to non-identity rest translation'
  );
  assertArrayClose(
    outputFor('scale').slice(0, 3),
    [3, 1.5, 8],
    'glTF scale must multiply non-identity rest scale'
  );
  const composedRotation =
    sampleComposedNumericTransformChannel(
      channels['channel-root-rotation'],
      0,
      { restValue: [10, 20, 30] }
    );
  if (!composedRotation) {
    throw new Error('Expected numeric composed rotation.');
  }
  assertArrayClose(
    outputFor('rotation').slice(0, 4),
    quaternionFromEuler(composedRotation),
    'glTF and live preview must use the same non-identity rest rotation composition',
    0.00005
  );
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const channel = project.animations['clip-idle']
    .channels['channel-root-rotation'];
  for (const key of channel.keys) {
    (key as { interpolation: string }).interpolation = 'catmullrom';
  }
  assert.equal(validateProjectDocument(project).valid, true);
  const compiled = buildGltf(project);
  const sampler = compiled.document.animations?.[0]?.samplers[0];
  assert.equal(sampler?.interpolation, 'LINEAR');
  const inputAccessor =
    sampler === undefined
      ? undefined
      : compiled.document.accessors?.[sampler.input];
  assert.ok((inputAccessor?.count ?? 0) > channel.keys.length);
}
