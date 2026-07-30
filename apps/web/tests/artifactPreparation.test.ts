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

const createAuthoredProject = (): ProjectDocument => {
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

const authored = createAuthoredProject();
const saveOperations = createArtifactPreparationOperations(
  authored,
  { kind: 'save' }
);
assert.deepEqual(saveOperations, []);

const target = {
  target: 'geckolib5' as const,
  namespace: 'ashfox',
  modelPath: 'prepared_model'
};
assert.deepEqual(
  createArtifactPreparationOperations(
    authored,
    { kind: 'export', target }
  ).map((operation) => operation.name),
  ['project.target.set'],
  'artifact preparation only changes the selected target'
);

const targetPrepared = executeCommandBatch(authored, {
  batchId: 'artifact-preparation-target',
  baseRevision: authored.revision,
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
  'same-target export must not create Activity or Undo work'
);
