import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  exportProductionProject,
  exportProductionProjectResolved,
  ProductionExportError,
  validateProjectDocument,
  type ExportPreset,
  type PartSpec,
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
  const part: PartSpec = {
    kind: 'plate',
    partId: 'body',
    parentPartId: null,
    materialId: 'stone',
    joint: { kind: 'fixed' },
    attachment: null,
    plane: 'xy',
    origin: [-2, 0, -3],
    outline: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4]
    ],
    thickness: 6
  };
  const { attachment: _attachment, ...authoredPart } = part;
  const operations: ProjectCommandOperation[] = [
    {
      name: 'project.create',
      payload: {
        name: `Export ${target}`,
        target
      }
    },
    {
      name: 'project.intent.set',
      payload: {
        subject: `Export ${target}`,
        forward: 'north',
        grounding: 'free',
        requiredFeatures: [
          'The exported plate remains visibly rectangular.'
        ],
        requiredPartIds: ['body'],
        requiredMaterialIds: ['stone'],
        requiredClipIds: ['animation-export-idle']
      }
    },
    {
      name: 'model.parts.upsert',
      payload: {
        parts: [authoredPart],
        materials: [{
          id: 'stone',
          baseColor: '#8E98A3'
        }]
      }
    },
    {
      name: 'animation.clip.upsert',
      payload: {
        id: 'animation-export-idle',
        name: 'animation.export.idle',
        durationSeconds: 1,
        fps: 20,
        loop: 'loop'
      }
    },
    {
      name: 'animation.channels.upsert',
      payload: {
        clipId: 'animation-export-idle',
        channels: [{
          id: 'channel-export-idle',
          targetNodeId: 'bone:body',
          property: 'rotation',
          keys: [{
            id: 'key-export-start',
            timeSeconds: 0,
            value: [0, 0, 0]
          }, {
            id: 'key-export-end',
            timeSeconds: 1,
            value: [0, 0, 0]
          }]
        }]
      }
    }
  ];
  const result = executeCommandBatch(base, {
    batchId: `batch-export-${target}`,
    baseProjectId: base.id,
    baseRevision: base.revision,
    operations
  }, { source: 'system' });
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

assert.throws(
  () => exportProductionProject(createGltfProject('glb')),
  ProductionExportError,
  'the public exporter must reject a structurally valid draft'
);

{
  const bundle = exportProductionProject(authorProject('geckolib5'));
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
  const bundle = exportProductionProject(authorProject('bedrock'));
  assert.equal(bundle.target.id, 'minecraft.bedrock');
  assert.deepEqual(
    bundle.files.map((file) => file.role),
    ['geometry', 'animation', 'texture']
  );
  assert.ok(bundle.entrypoints[0]?.endsWith('.geo.json'));
  assert.ok(bundle.entrypoints[1]?.endsWith('.animation.json'));
  assert.ok(bundle.files[2]?.path.endsWith('.png'));
}

{
  const bundle = exportProductionProject(authorProject('gltf'));
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
    const bundle = await exportProductionProjectResolved(
      authorProject('glb'),
      {
      resolveBlob: async () => ({
        bytes: validationPng,
        contentType: 'image/png'
      })
      }
    );
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
