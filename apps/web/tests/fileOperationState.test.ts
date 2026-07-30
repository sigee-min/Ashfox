import assert from 'node:assert/strict';

import {
  fileOperationReducer,
  INITIAL_FILE_OPERATION
} from '../src/features/files/fileOperationState';
import type { ArtifactFile } from '../src/features/files/artifactFile';

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

const progress = fileOperationReducer(running, {
  type: 'progress',
  operationId: 1,
  message: 'Captured 4/10 frames'
});
assert.deepEqual(progress, {
  phase: 'running',
  operationId: 1,
  kind: 'open',
  message: 'Captured 4/10 frames',
  result: null
});

const staleProgress = fileOperationReducer(progress, {
  type: 'progress',
  operationId: 0,
  message: 'Stale progress'
});
assert.equal(staleProgress, progress);

const staleCompletion = fileOperationReducer(running, {
  type: 'settle',
  operationId: 0,
  phase: 'failed',
  message: 'Stale failure',
  result: null
});
assert.equal(staleCompletion, running);

const cancelled = fileOperationReducer(running, {
  type: 'settle',
  operationId: 1,
  phase: 'cancelled',
  message: 'Open cancelled',
  result: null
});
assert.deepEqual(cancelled, {
  phase: 'cancelled',
  operationId: 1,
  kind: 'open',
  message: 'Open cancelled',
  result: null
});
const lateSuccessAfterCancel = fileOperationReducer(cancelled, {
  type: 'settle',
  operationId: 1,
  phase: 'succeeded',
  message: 'Late artifact',
  result: null
});
assert.equal(
  lateSuccessAfterCancel,
  cancelled,
  'cancel is terminal even when non-interruptible work completes later'
);

const retried = fileOperationReducer(cancelled, {
  type: 'start',
  operationId: 2,
  kind: 'open',
  message: 'Opening project'
});
assert.equal(retried.phase, 'running');
assert.equal(retried.operationId, 2);

const captureRunning = fileOperationReducer<{ name: string }>(
  INITIAL_FILE_OPERATION,
  {
    type: 'start',
    operationId: 1,
    kind: 'capture',
    message: 'Capturing'
  }
);
const captureReady = fileOperationReducer(captureRunning, {
  type: 'settle',
  operationId: 1,
  phase: 'succeeded',
  message: 'GIF ready',
  result: { name: 'demo.gif' }
});
assert.deepEqual(captureReady, {
  phase: 'succeeded',
  operationId: 1,
  kind: 'capture',
  message: 'GIF ready',
  result: { name: 'demo.gif' }
});

const nextOperation = fileOperationReducer(captureReady, {
  type: 'start',
  operationId: 2,
  kind: 'open',
  message: 'Opening project'
});
assert.equal(nextOperation.result, null);

const projectArtifact: ArtifactFile = {
  kind: 'project',
  name: 'moonveil-kirin.ashfox',
  contentType: 'application/vnd.ashfox.project+zip',
  bytes: new Uint8Array([1, 2, 3])
};
const saveRunning = fileOperationReducer<ArtifactFile>(
  INITIAL_FILE_OPERATION,
  {
    type: 'start',
    operationId: 1,
    kind: 'save',
    message: 'Preparing project file'
  }
);
const artifactReady = fileOperationReducer(saveRunning, {
  type: 'settle',
  operationId: 1,
  phase: 'succeeded',
  message: `Ready · ${projectArtifact.name}`,
  result: projectArtifact
});
assert.equal(artifactReady.result, projectArtifact);

const staleAfterReady = fileOperationReducer(artifactReady, {
  type: 'settle',
  operationId: 0,
  phase: 'failed',
  message: 'Stale failure',
  result: null
});
assert.equal(
  staleAfterReady,
  artifactReady,
  'the terminal artifact must remain available until a newer operation starts'
);
