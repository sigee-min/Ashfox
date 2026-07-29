import assert from 'node:assert/strict';

import { createWorkbenchProject } from '../src/features/workbench/sampleProject';
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
    schemaVersion: 1,
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

const importedDocument = {
  ...createWorkbenchProject(),
  id: 'imported-project',
  revision: 'source-revision'
};
const imported = historyReducer(rejected, {
  type: 'hydrate',
  record: {
    schemaVersion: 1,
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
