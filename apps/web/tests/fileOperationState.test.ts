import assert from 'node:assert/strict';

import {
  fileOperationReducer,
  INITIAL_FILE_OPERATION
} from '../src/features/files/fileOperationState';

const running = fileOperationReducer(INITIAL_FILE_OPERATION, {
  type: 'start',
  operationId: 1,
  kind: 'open',
  message: 'Opening project'
});
assert.equal(running.phase, 'running');

const duplicateStart = fileOperationReducer(running, {
  type: 'start',
  operationId: 2,
  kind: 'export',
  message: 'Building export'
});
assert.equal(duplicateStart, running);

const staleCompletion = fileOperationReducer(running, {
  type: 'settle',
  operationId: 0,
  phase: 'failed',
  message: 'Stale failure'
});
assert.equal(staleCompletion, running);

const cancelled = fileOperationReducer(running, {
  type: 'settle',
  operationId: 1,
  phase: 'cancelled',
  message: 'Open cancelled'
});
assert.deepEqual(cancelled, {
  phase: 'cancelled',
  operationId: 1,
  kind: 'open',
  message: 'Open cancelled'
});

const retried = fileOperationReducer(cancelled, {
  type: 'start',
  operationId: 2,
  kind: 'open',
  message: 'Opening project'
});
assert.equal(retried.phase, 'running');
assert.equal(retried.operationId, 2);
