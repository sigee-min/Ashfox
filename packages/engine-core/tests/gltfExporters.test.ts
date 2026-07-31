import assert from 'node:assert/strict';

import validator from 'gltf-validator';

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
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4'
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
  }
};

const readFloatAccessor = (
  compiled: CompiledGltf,
  accessorIndex: number
): number[] => {
  const accessor = compiled.document.accessors?.[accessorIndex];
  if (!accessor) throw new Error('Expected glTF accessor.');
  assert.equal(accessor.componentType, 5126);
  const bufferView =
    compiled.document.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error('Expected glTF buffer view.');
  const componentCount = accessorComponentCount(accessor.type);
  const offset =
    bufferView.byteOffset + (accessor.byteOffset ?? 0);
  const view = new DataView(
    compiled.binary.buffer,
    compiled.binary.byteOffset,
    compiled.binary.byteLength
  );
  return Array.from(
    { length: accessor.count * componentCount },
    (_, index) => view.getFloat32(offset + index * 4, true)
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
  message: string
): void => {
  assert.equal(actual.length, expected.length, message);
  expected.forEach((value, index) => {
    assert.ok(
      Math.abs((actual[index] ?? Number.NaN) - value) < 0.000001,
      `${message}: component ${index}`
    );
  });
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
      assert.equal(report.issues.numInfos, 0);
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
  const primitive = compiled.document.meshes?.[1]?.primitives[0];
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
  const output = readFloatAccessor(
    compiled,
    sampler.output
  );
  assertArrayClose(
    output.slice(10 * 4, 11 * 4),
    quaternionFromEuler([45, 45, 0]),
    'glTF rotation baking must sample the same 20 fps Euler pose as live preview'
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
  assert.equal(inputAccessor?.count, 21);
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
  assert.equal(inputAccessor?.count, 41);
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
    return readFloatAccessor(
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
    'glTF and live preview must use the same non-identity rest rotation composition'
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
