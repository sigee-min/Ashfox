import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  type CommandBatch,
  type PartSpec,
  type ProjectDocument
} from '../src';

const root: PartSpec = {
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'stone',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xy',
  origin: [-2, 0, 0],
  outline: [[0, 0], [4, 0], [4, 4], [0, 4]],
  thickness: 4
};

const upsert: CommandBatch['operations'][number] = {
  name: 'model.parts.upsert',
  payload: {
    parts: [root],
    materials: [{ id: 'stone', baseColor: '#778899' }]
  }
};

const removeForeign: CommandBatch['operations'][number] = {
  name: 'scene.nodes.delete',
  payload: { nodeIds: ['foreign-cube'] }
};

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source: 'system' }
  );

const empty = createProjectFromInput(
  {
    id: 'part-environment-composition',
    name: 'Part environment composition',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'part_environment_composition',
    createdAt: '2026-07-30T00:00:00.000Z'
  },
  'environment-0001'
);

const withForeign = execute(empty, 'create-foreign', [{
  name: 'scene.cubes.create',
  payload: {
    cubes: [{
      id: 'foreign-cube',
      name: 'foreign',
      parentId: null,
      bounds: {
        from: [0, 0, 0],
        to: [1, 1, 1]
      }
    }]
  }
}]);
assert.equal(withForeign.ok, true);
if (!withForeign.ok) throw new Error(withForeign.error.message);

const overlapping = execute(
  withForeign.document,
  'reject-foreign-overlap',
  [upsert]
);
assert.equal(overlapping.ok, false);
if (!overlapping.ok) {
  assert.equal(overlapping.error.code, 'invalid_state');
  assert.match(overlapping.error.path ?? '', /^scene\.nodes\./);
  assert.doesNotMatch(overlapping.error.path ?? '', /payload/);
}
assert.equal(
  withForeign.document.scene.nodes['bone:body'],
  undefined,
  'a rejected environment invariant must not leak generated nodes'
);

const partFirst = execute(
  withForeign.document,
  'replace-foreign-part-first',
  [upsert, removeForeign]
);
assert.equal(partFirst.ok, true);
if (!partFirst.ok) throw new Error(partFirst.error.message);

const removalFirst = execute(
  withForeign.document,
  'replace-foreign-removal-first',
  [removeForeign, upsert]
);
assert.equal(removalFirst.ok, true);
if (!removalFirst.ok) throw new Error(removalFirst.error.message);

assert.deepEqual(
  removalFirst.document,
  partFirst.document,
  'foreign overlap is a final-state invariant and cannot make batch order observable'
);
