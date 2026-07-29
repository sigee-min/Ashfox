import assert from 'node:assert/strict';

import validator from 'gltf-validator';

import {
  BlobResolutionError,
  ExportMaterializationRequiredError,
  buildGltf,
  exportGltf,
  exportProjectResolved,
  validateProjectDocument
} from '../src';
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
      const bundle = await exportProjectResolved(project, {
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
    exportProjectResolved(project, {
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
    exportProjectResolved(project, {
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
    exportProjectResolved(project, {
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
