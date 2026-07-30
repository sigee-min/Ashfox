import assert from 'node:assert/strict';

import { createProjectFromInput } from '@ashfox/engine-core';

import { createWorkbenchProject } from '../src/features/workbench/sampleProject';
import { LOCAL_PROJECT_SCHEMA_VERSION } from '../src/features/workbench/persistence/localProjectRecord';
import {
  createHistoryState,
  historyReducer
} from '../src/features/workbench/state/historyReducer';

const initial = createHistoryState(createWorkbenchProject());
const committed = historyReducer(initial, {
  type: 'execute',
  batch: {
    batchId: 'test-commit',
    baseRevision: initial.present.revision,
    operations: [{
      name: 'project.rename',
      payload: {
        name: 'State test'
      }
    }]
  },
  actorId: 'test',
  source: 'web',
  committedAt: '2026-01-01T00:00:00.000Z'
});

assert.equal(committed.present.name, 'State test');
assert.equal(committed.lastCommandOutcome?.status, 'committed');
assert.equal(committed.lastCommandOutcome?.commandId, 'test-commit');

const identicalHydration = historyReducer(committed, {
  type: 'hydrate',
  record: {
    schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
    projectId: committed.present.id,
    revision: committed.present.revision,
    document: committed.present,
    assets: {},
    activity: committed.activity,
    savedAt: '2026-01-01T00:00:00.500Z'
  }
});
assert.deepEqual(identicalHydration.past, committed.past);
assert.equal(identicalHydration.present, committed.present);

const rejected = historyReducer(committed, {
  type: 'execute',
  batch: {
    batchId: 'test-stale',
    baseRevision: initial.present.revision,
    operations: [{
      name: 'project.rename',
      payload: {
        name: 'Must not apply'
      }
    }]
  },
  actorId: 'test',
  source: 'agent',
  committedAt: '2026-01-01T00:00:01.000Z'
});

assert.equal(rejected.present, committed.present);
assert.deepEqual(rejected.lastCommandOutcome, {
  status: 'rejected',
  commandId: 'test-stale',
  revision: committed.present.revision,
  error: {
    code: 'revision_mismatch',
    message: 'Batch revision does not match the active project.',
    path: 'baseRevision',
    expected: committed.present.revision
  }
});

const invalidPayload = historyReducer(committed, {
  type: 'execute',
  batch: {
    batchId: 'test-invalid-payload',
    baseRevision: committed.present.revision,
    operations: [{
      name: 'project.rename',
      payload: {
        name: 42
      }
    }]
  },
  actorId: 'test',
  source: 'agent',
  committedAt: '2026-01-01T00:00:01.000Z'
});
assert.equal(invalidPayload.present, committed.present);
assert.equal(invalidPayload.past, committed.past);
assert.equal(invalidPayload.activity, committed.activity);
assert.equal(invalidPayload.lastCommandOutcome?.status, 'rejected');
if (invalidPayload.lastCommandOutcome?.status === 'rejected') {
  assert.equal(
    invalidPayload.lastCommandOutcome.error.code,
    'invalid_payload'
  );
}

const rawAgentCommand = historyReducer(committed, {
  type: 'execute',
  batch: {
    batchId: 'test-agent-raw-command',
    baseRevision: committed.present.revision,
    operations: [{
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-agent-raw',
          name: 'raw',
          parentId: null,
          bounds: {
            from: [0, 0, 0],
            to: [1, 1, 1]
          }
        }]
      }
    }]
  },
  actorId: 'test',
  source: 'agent',
  committedAt: '2026-01-01T00:00:01.500Z'
});
assert.equal(rawAgentCommand.present, committed.present);
assert.equal(rawAgentCommand.activity, committed.activity);
assert.equal(rawAgentCommand.lastCommandOutcome?.status, 'rejected');
if (rawAgentCommand.lastCommandOutcome?.status === 'rejected') {
  assert.equal(
    rawAgentCommand.lastCommandOutcome.error.code,
    'invalid_payload'
  );
}

const partDocument = createProjectFromInput(
  {
    id: 'project-part-history',
    name: 'Part history',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'part_history',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  'local-0001'
);
const partInitial = createHistoryState(partDocument);
const partCommitted = historyReducer(partInitial, {
  type: 'execute',
  batch: {
    batchId: 'test-part-upsert',
    baseRevision: partDocument.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'plate',
          partId: 'body',
          parentPartId: null,
          materialId: 'stone',
          joint: { kind: 'fixed' },
          attachment: null,
          plane: 'xy',
          origin: [-1, 0, -1],
          outline: [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2]
          ],
          thickness: 2
        }],
        materials: [{
          id: 'stone',
          baseColor: '#778899'
        }]
      }
    }]
  },
  actorId: 'test',
  source: 'agent',
  committedAt: '2026-01-01T00:00:02.000Z'
});
assert.equal(partCommitted.lastCommandOutcome?.status, 'committed');
assert.ok(partCommitted.present.scene.nodes['bone:body']);
const partUndone = historyReducer(partCommitted, {
  type: 'undo',
  commandId: 'test-part-undo',
  committedAt: '2026-01-01T00:00:03.000Z'
});
assert.deepEqual(partUndone.present.scene, partDocument.scene);
assert.deepEqual(partUndone.present.textures, partDocument.textures);

const importedDocument = {
  ...createWorkbenchProject(),
  id: 'imported-project',
  revision: 'source-revision'
};
const imported = historyReducer(rejected, {
  type: 'hydrate',
  record: {
    schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
    projectId: importedDocument.id,
    revision: importedDocument.revision,
    document: importedDocument,
    assets: {},
    activity: [],
    savedAt: '2026-01-01T00:00:02.000Z'
  }
});
assert.equal(imported.present.id, 'imported-project');
assert.equal(imported.present.revision, 'local-0001');
assert.equal(imported.past.length, 0);
