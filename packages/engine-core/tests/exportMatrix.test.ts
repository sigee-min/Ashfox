import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  exportProject,
  exportProjectResolved,
  validateProjectDocument,
  type ExportPreset,
  type ProjectCommandOperation,
  type ProjectDocument
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

const authorProject = (target: ExportPreset): ProjectDocument => {
  const base = createGltfProject();
  const operations: ProjectCommandOperation[] = [
    {
      name: 'project.create',
      payload: {
        id: `project-export-${target}`,
        name: `Export ${target}`,
        target,
        namespace: 'ashfox',
        modelPath: `export_${target}`,
        textureResolution: 32,
        createdAt: '2026-07-30T00:00:00.000Z'
      }
    },
    {
      name: 'scene.bones.create',
      payload: {
        bones: [{
          id: 'bone-root',
          name: 'root',
          parentId: null
        }]
      }
    },
    {
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-body',
          name: 'body',
          parentId: 'bone-root',
          bounds: {
            from: [-2, 0, -3],
            to: [2, 4, 3]
          }
        }]
      }
    },
    {
      name: 'textures.uvAtlas.generate',
      payload: {
        target: { scope: 'all' },
        pixelsPerBlock: 16,
        padding: 1,
        maxResolution: 128,
        seed: 37,
        intensity: 0.22,
        edge: 0.12,
        noise: 0.06,
        lightDir: 'tl_br'
      }
    }
  ];
  const result = executeCommandBatch(base, {
    batchId: `batch-export-${target}`,
    baseRevision: base.revision,
    operations
  });
  if (!result.ok) throw new Error(result.error.message);
  const report = validateProjectDocument(result.document);
  assert.equal(report.valid, true);
  assert.deepEqual(
    report.findings.filter(
      (finding) => finding.severity !== 'info'
    ),
    [],
    `${target} command-authored project must be production ready`
  );
  return result.document;
};

{
  const bundle = exportProject(authorProject('geckolib5'));
  assert.equal(bundle.target.id, 'minecraft.java.geckolib5');
  assert.deepEqual(
    bundle.files.map((file) => file.role),
    ['geometry', 'animation', 'texture']
  );
  assert.ok(bundle.entrypoints[0]?.endsWith('.geo.json'));
  assert.ok(bundle.entrypoints[1]?.endsWith('.animation.json'));
  assert.ok(bundle.files[2]?.path.endsWith('.png'));
}

{
  const bundle = exportProject(authorProject('bedrock'));
  assert.equal(bundle.target.id, 'minecraft.bedrock');
  assert.deepEqual(
    bundle.files.map((file) => file.role),
    ['geometry', 'texture']
  );
  assert.ok(bundle.entrypoints[0]?.endsWith('.geo.json'));
  assert.ok(bundle.files[1]?.path.endsWith('.png'));
}

{
  const bundle = exportProject(authorProject('gltf'));
  assert.equal(bundle.target.id, 'gltf.2');
  assert.deepEqual(
    bundle.files.map((file) => file.role),
    ['model', 'buffer', 'texture']
  );
  assert.ok(bundle.entrypoints[0]?.endsWith('.gltf'));
  assert.ok(bundle.files[1]?.path.endsWith('.bin'));
  assert.ok(bundle.files[2]?.path.endsWith('.png'));
}

registerAsyncTest(
  (async () => {
    const bundle = await exportProjectResolved(authorProject('glb'), {
      resolveBlob: async () => ({
        bytes: validationPng,
        contentType: 'image/png'
      })
    });
    assert.equal(bundle.target.id, 'gltf.2');
    assert.equal(bundle.files.length, 1);
    const model = bundle.files[0];
    assert.equal(model?.kind, 'binary');
    assert.equal(model?.contentType, 'model/gltf-binary');
    if (model?.kind !== 'binary') {
      throw new Error('Embedded GLB artifact missing');
    }
    const view = new DataView(
      model.data.buffer,
      model.data.byteOffset,
      model.data.byteLength
    );
    assert.equal(view.getUint32(0, true), 0x46546c67);
    assert.ok(bundle.entrypoints[0]?.endsWith('.glb'));
  })()
);
