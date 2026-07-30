import assert from 'node:assert/strict';

import {
  LOCAL_PROJECT_SCHEMA_VERSION,
  type LocalProjectRecord
} from '../src/features/workbench/persistence/localProjectRecord';
import { createWorkbenchProject } from '../src/features/workbench/sampleProject';
import { createHistoryState } from '../src/features/workbench/state/historyReducer';
import {
  createProjectSessionState,
  projectSessionReducer
} from '../src/features/workbench/state/projectSessionReducer';

const document = createWorkbenchProject();
const initialAssets = {
  initial: {
    contentType: 'image/png',
    bytes: new Uint8Array([1])
  }
};
const initial = createProjectSessionState(
  createHistoryState(document),
  initialAssets
);
assert.equal(initial.storage.restoreFromStorage, true);
assert.equal(
  createProjectSessionState(
    createHistoryState(document),
    initialAssets,
    false
  ).storage.restoreFromStorage,
  false
);

const importedDocument = {
  ...document,
  id: 'project-imported',
  revision: 'source-revision'
};
const importedAssets = {
  imported: {
    contentType: 'image/png',
    bytes: new Uint8Array([2])
  }
};
const importedRecord: LocalProjectRecord = {
  schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
  projectId: importedDocument.id,
  revision: importedDocument.revision,
  document: importedDocument,
  assets: importedAssets,
  activity: [],
  savedAt: '2026-01-01T00:00:00.000Z'
};
const replaced = projectSessionReducer(initial, {
  type: 'replace',
  record: importedRecord
});
assert.equal(replaced.history.present.id, importedDocument.id);
assert.equal(replaced.assets, importedAssets);
assert.deepEqual(replaced.storage, {
  generation: 1,
  restoreFromStorage: false
});

const staleExternal = projectSessionReducer(replaced, {
  type: 'external',
  record: {
    ...importedRecord,
    assets: initialAssets
  }
});
assert.equal(staleExternal, replaced);
assert.equal(staleExternal.assets, importedAssets);

const hydratedAssets = {
  hydrated: {
    contentType: 'image/png',
    bytes: new Uint8Array([3])
  }
};
const hydrated = projectSessionReducer(replaced, {
  type: 'hydrate',
  record: {
    ...importedRecord,
    document: replaced.history.present,
    revision: replaced.history.present.revision,
    assets: hydratedAssets
  }
});
assert.equal(hydrated.history.present, replaced.history.present);
assert.equal(hydrated.assets, hydratedAssets);
assert.equal(hydrated.storage, replaced.storage);

const created = projectSessionReducer(hydrated, {
  type: 'execute',
  batch: {
    batchId: 'batch-create-clean-project',
    baseRevision: hydrated.history.present.revision,
    operations: [{
      name: 'project.create',
      payload: {
        id: 'project-clean',
        name: 'Clean project',
        target: 'glb',
        namespace: 'ashfox',
        modelPath: 'clean_project',
        createdAt: '2026-07-29T01:00:00.000Z'
      }
    }]
  },
  actorId: 'agent-test',
  source: 'agent',
  committedAt: '2026-07-29T01:00:01.000Z'
});
assert.equal(created.history.present.id, 'project-clean');
assert.equal(created.history.present.revision, 'local-0001');
assert.deepEqual(created.history.past, []);
assert.deepEqual(created.history.future, []);
assert.equal(created.history.activity.length, 1);
assert.equal(created.history.activity[0].projectId, 'project-clean');
assert.equal(created.history.lastCommandOutcome?.status, 'committed');
assert.deepEqual(created.assets, {});
assert.deepEqual(created.storage, {
  generation: 2,
  restoreFromStorage: false
});

const undoCreatedProject = projectSessionReducer(created, {
  type: 'undo',
  commandId: 'undo-project-create',
  committedAt: '2026-07-29T01:00:02.000Z'
});
assert.equal(
  undoCreatedProject,
  created,
  'creating a new project must not leave the previous project in Undo history'
);
