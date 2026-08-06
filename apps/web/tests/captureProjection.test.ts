import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeSystemCommandBatch
} from '@ashfox/engine-core';

import {
  createCaptureProjection
} from '../src/features/capture/createCaptureProjection';
import {
  createWorkbenchProject
} from './fixtures/workbenchProject';

const empty = createProjectFromInput(
  {
    id: 'project-capture-fixture',
    name: 'Capture fixture',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'capture_fixture',
    createdAt: '2026-07-29T00:00:00.000Z'
  },
  'local-0001'
);
const created = executeSystemCommandBatch(empty, {
  batchId: 'capture-fixture-bone',
  baseProjectId: empty.id,
  baseRevision: empty.revision,
  operations: [{
    name: 'scene.bones.create',
    payload: {
      bones: [{
        id: 'bone-capture-fixture',
        name: 'capture_fixture',
        parentId: null,
        transform: {
          pivot: [0, 0, 0]
        }
      }]
    }
  }]
});
assert.equal(created.ok, true);
if (!created.ok) throw new Error(created.error.message);

const projection = createCaptureProjection(created.document, {});
const overlays: string[] = [];
projection.root.traverse((object) => {
  if (object.userData.overlay) overlays.push(object.name);
});
assert.deepEqual(
  overlays,
  [],
  'GIF capture must never render skeleton or wireframe overlays'
);
projection.dispose();

const untextured = {
  ...createWorkbenchProject(),
  textures: {}
};
const untexturedProjection = createCaptureProjection(untextured, {});
let meshCount = 0;
untexturedProjection.root.traverse((object) => {
  if (object.type === 'Mesh') meshCount += 1;
});
assert.ok(
  meshCount > 0,
  'Build capture must render geometry before its textures exist'
);
untexturedProjection.dispose();

const stagedProjection = createCaptureProjection(
  createWorkbenchProject(),
  {},
  { showTextures: false }
);
const stagedColors = new Set<string>();
stagedProjection.root.traverse((object) => {
  if (object.type !== 'Mesh') return;
  const material = (object as unknown as {
    material?:
      | { color?: { getHexString(): string } }
      | Array<{ color?: { getHexString(): string } }>;
  }).material;
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    const color = item?.color?.getHexString();
    if (color) stagedColors.add(color);
  }
});
assert.deepEqual(
  [...stagedColors],
  ['b59a74'],
  'Geometry capture stages must use one legible untextured material'
);
stagedProjection.dispose();
