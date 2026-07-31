import assert from 'node:assert/strict';

import {
  createCycleObservation
} from '../src/features/agent/cycleObservation';
import {
  observePresentationFrame,
  presentationCancellationResult,
  presentationTimeoutResult,
  stalePresentationResult,
  type PresentationSession
} from '../src/features/workbench/presentation/presentationSession';
import type {
  ViewportPresentationFrame
} from '../src/features/workbench/viewport/viewportTypes';

const session = (
  mode: PresentationSession['mode'] = 'frame'
): PresentationSession => ({
  nonce: 7,
  projectId: 'project-test',
  sourceRevision: 'local-0001',
  mode,
  camera: 'front',
  clipId: mode === 'cycle' ? 'clip-idle' : null,
  timeSeconds: 0,
  cycle:
    mode === 'cycle'
      ? createCycleObservation(1, 20)
      : null,
  phase: 'observing',
  previewIssues: []
});

const frame = (
  values: Partial<ViewportPresentationFrame> = {}
): ViewportPresentationFrame => ({
  presentationNonce: 7,
  frameNonce: 11,
  projectId: 'project-test',
  revision: 'local-0001',
  camera: 'front',
  cameraMatrix: [1, 0, 0, 0],
  clipId: null,
  playing: false,
  timeSeconds: 0,
  projectionStatus: 'ready',
  projectionError: null,
  ...values
});

const frameResult = observePresentationFrame(
  session(),
  frame()
);
assert.equal(frameResult.session, null);
assert.equal(frameResult.result?.ok, true);
if (frameResult.result?.ok) {
  assert.equal(frameResult.result.data.completedCycles, 0);
}

const stale = observePresentationFrame(
  session(),
  frame({ revision: 'local-0002' })
);
assert.equal(stale.session, null);
assert.equal(stale.playbackEffect, 'stop');
assert.equal(stale.result?.ok, false);
if (stale.result && !stale.result.ok) {
  assert.equal(stale.result.error.code, 'stale_revision');
}

const projectionFailure = observePresentationFrame(
  session(),
  frame({
    projectionStatus: 'failed',
    projectionError: 'texture decode failed'
  })
);
assert.equal(projectionFailure.session, null);
assert.equal(projectionFailure.result?.ok, false);
if (projectionFailure.result && !projectionFailure.result.ok) {
  assert.equal(
    projectionFailure.result.error.code,
    'preview_unavailable'
  );
}

let cycle = session('cycle');
for (const timeSeconds of [0, 0.25, 0.5, 0.75]) {
  const transition = observePresentationFrame(
    cycle,
    frame({
      clipId: 'clip-idle',
      playing: true,
      timeSeconds
    })
  );
  assert.equal(transition.result, null);
  assert.ok(transition.session);
  cycle = transition.session;
}
const completed = observePresentationFrame(
  cycle,
  frame({
    clipId: 'clip-idle',
    playing: true,
    timeSeconds: 1
  })
);
assert.equal(completed.result, null);
assert.equal(completed.playbackEffect, 'stop_and_rewind');
assert.equal(completed.session?.phase, 'closing');

const closed = observePresentationFrame(
  completed.session as PresentationSession,
  frame({
    clipId: 'clip-idle',
    playing: false,
    timeSeconds: 0
  })
);
assert.equal(closed.session, null);
assert.equal(closed.result?.ok, true);
if (closed.result?.ok) {
  assert.equal(closed.result.data.completedCycles, 1);
}

const timeout = presentationTimeoutResult(
  session('cycle'),
  'local-0001'
);
assert.equal(timeout.ok, false);
if (!timeout.ok) assert.equal(timeout.error.code, 'render_timeout');

const cancelled = presentationCancellationResult(
  'local-0001',
  'mounted viewport'
);
assert.equal(cancelled.ok, false);
if (!cancelled.ok) assert.equal(cancelled.error.code, 'invalid_state');

const revisionChanged = stalePresentationResult(
  'local-0002',
  'local-0001'
);
assert.equal(revisionChanged.ok, false);
if (!revisionChanged.ok) {
  assert.equal(revisionChanged.error.code, 'stale_revision');
  assert.equal(revisionChanged.error.expected, 'local-0001');
}
