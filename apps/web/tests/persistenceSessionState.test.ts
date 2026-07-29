import assert from 'node:assert/strict';

import {
  createPersistenceSessionState,
  persistenceSessionReducer
} from '../src/features/workbench/persistence/persistenceSessionState';

const session = {
  projectId: 'project-a',
  projectGeneration: 1
};
const initial = createPersistenceSessionState(session, true);
const ready = persistenceSessionReducer(initial, {
  type: 'ready',
  session,
  lastSavedAt: null
});
assert.equal(ready.ready, true);
assert.equal(ready.authoritative, true);
assert.equal(ready.status, 'saved');

const saving = persistenceSessionReducer(ready, {
  type: 'saving',
  session
});
assert.equal(saving.status, 'saving');

const saved = persistenceSessionReducer(saving, {
  type: 'saved',
  session,
  lastSavedAt: '2026-01-01T00:00:00.000Z'
});
assert.equal(saved.authoritative, false);
assert.equal(saved.status, 'saved');

const stale = persistenceSessionReducer(saved, {
  type: 'error',
  session: {
    projectId: 'project-a',
    projectGeneration: 0
  }
});
assert.equal(stale, saved);

const restarted = persistenceSessionReducer(saved, {
  type: 'begin',
  session: {
    projectId: 'project-b',
    projectGeneration: 2
  },
  authoritative: false
});
assert.deepEqual(restarted, {
  projectId: 'project-b',
  projectGeneration: 2,
  authoritative: false,
  ready: false,
  status: 'loading',
  lastSavedAt: null
});
