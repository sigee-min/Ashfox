import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createArtifactPreparationOperations
} from '../src/features/files/artifactPreparation';
import {
  createBlankWorkbenchProject
} from '../src/features/workbench/newProject';
import {
  createHistoryState,
  historyReducer
} from '../src/features/workbench/state/historyReducer';

const createUnsynchronizedProject = (): ProjectDocument => {
  const document = createBlankWorkbenchProject(
    '2026-07-30T00:00:00.000Z'
  );
  const created = executeCommandBatch(document, {
    batchId: 'artifact-preparation-fixture',
    baseRevision: document.revision,
    operations: [{
      name: 'scene.bones.create',
      payload: {
        bones: [{
          id: 'bone-root',
          name: 'root',
          parentId: null
        }]
      }
    }, {
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-body',
          name: 'body',
          parentId: 'bone-root',
          bounds: {
            from: [-2, 0, -2],
            to: [2, 4, 2]
          }
        }]
      }
    }]
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.document;
};

const unsynchronized = createUnsynchronizedProject();
const saveOperations = createArtifactPreparationOperations(
  unsynchronized,
  { kind: 'save' }
);
assert.deepEqual(
  saveOperations.map((operation) => operation.name),
  ['textures.sync']
);

const initial = createHistoryState(unsynchronized);
const committed = historyReducer(initial, {
  type: 'execute',
  batch: {
    batchId: 'artifact-preparation-sync',
    baseRevision: unsynchronized.revision,
    operations: saveOperations
  },
  actorId: 'web-local',
  source: 'web',
  committedAt: '2026-07-30T00:00:01.000Z'
});
assert.equal(committed.lastCommandOutcome?.status, 'committed');
assert.equal(committed.present.revision, 'local-0002');
assert.equal(committed.past.length, 1);
assert.equal(committed.activity[0]?.commandId, 'artifact-preparation-sync');
assert.deepEqual(
  createArtifactPreparationOperations(
    committed.present,
    { kind: 'save' }
  ),
  [],
  'an already synchronized save must not create Activity or Undo work'
);

const target = {
  target: 'geckolib5' as const,
  namespace: 'ashfox',
  modelPath: 'prepared_model'
};
assert.deepEqual(
  createArtifactPreparationOperations(
    unsynchronized,
    { kind: 'export', target }
  ).map((operation) => operation.name),
  ['project.target.set', 'textures.sync'],
  'target selection and texture synchronization must share one atomic batch'
);
assert.deepEqual(
  createArtifactPreparationOperations(
    committed.present,
    { kind: 'export', target }
  ).map((operation) => operation.name),
  ['project.target.set']
);

const targetPrepared = executeCommandBatch(committed.present, {
  batchId: 'artifact-preparation-target',
  baseRevision: committed.present.revision,
  operations: [{
    name: 'project.target.set',
    payload: target
  }]
});
if (!targetPrepared.ok) {
  throw new Error(targetPrepared.error.message);
}
assert.deepEqual(
  createArtifactPreparationOperations(
    targetPrepared.document,
    { kind: 'export', target }
  ),
  [],
  'same-target synchronized export must not create Activity or Undo work'
);
