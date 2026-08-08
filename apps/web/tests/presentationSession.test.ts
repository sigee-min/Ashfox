import assert from 'node:assert/strict';

import {
  createCycleObservation
} from '../src/features/agent/cycleObservation';
import {
  observePresentationFrame,
  presentationCancellationResult,
  snapshotPresentationObservation,
  presentationTimeoutResult,
  stalePresentationResult,
  type PresentationSession
} from '../src/features/workbench/presentation/presentationSession';
import type {
  ViewportPresentationFrame
} from '../src/features/workbench/viewport/viewportTypes';
import { FRAME_EVIDENCE_FIXTURE } from './fixtures/frameEvidence';

const session = (
  mode: PresentationSession['mode'] = 'frame',
  review: PresentationSession['review'] = 'next'
): PresentationSession => ({
  nonce: 7,
  projectId: 'project-test',
  sourceRevision: 'local-0001',
  review,
  purpose: review === 'next' ? 'delivery' : 'preview',
  milestone: review === 'preview' ? 'specialists' : null,
  mode,
  camera: 'front',
  clipId: mode === 'cycle' ? 'clip-idle' : null,
  timeSeconds: 0,
  cycle:
    mode === 'cycle'
      ? createCycleObservation(1, 20)
      : null,
  phase: 'observing',
  previewIssues: [],
  reviewChecks: [{
    id: 'specialist.mechanic.role-read',
    facets: ['role-prop'],
    issue: 'focal_detail',
    instruction: 'Read the mechanic role.',
    authority: {
      id: 'specialist.role-props',
      version: 1
    },
    authorityType: 'specialist',
    evidence: {
      criteria: [{
        id: 'criterion.role-cue',
        basis: 'either',
        required: true,
        instruction: 'Ground the role cue.'
      }],
      claims: [{
        criterionId: 'criterion.role-cue',
        basis: 'requested',
        referenceIds: ['intent.subject'],
        rationale: 'The requested subject carries this role.'
      }]
    }
  }]
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
  frameEvidence: structuredClone(FRAME_EVIDENCE_FIXTURE),
  frameEvidenceError: null,
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
  assert.equal(frameResult.result.data.review, 'next');
  assert.equal(frameResult.result.data.purpose, 'delivery');
  assert.equal(frameResult.result.data.milestone, null);
  assert.equal(frameResult.result.data.verdict, 'pending');
  assert.equal(frameResult.result.data.completedCycles, 0);
  assert.deepEqual(
    frameResult.result.data.frameEvidence,
    FRAME_EVIDENCE_FIXTURE
  );
  assert.deepEqual(
    frameResult.result.data.reviewChecks.map((check) => check.id),
    ['specialist.mechanic.role-read']
  );
  const snapshot = snapshotPresentationObservation(
    frameResult.result
  );
  (
    frameResult.result.data.reviewChecks as {
      id: string;
      evidence: {
        claims: { criterionId: string }[];
      };
    }[]
  )[0].id = 'mutated.by.caller';
  (
    frameResult.result.data.reviewChecks as {
      evidence: {
        claims: { criterionId: string }[];
      };
    }[]
  )[0].evidence.claims[0].criterionId = 'criterion.mutated';
  assert.equal(
    snapshot.data.reviewChecks[0].id,
    'specialist.mechanic.role-read',
    'the stored observation must not share mutable result data'
  );
  assert.equal(
    snapshot.data.reviewChecks[0].evidence.claims[0].criterionId,
    'criterion.role-cue',
    'the stored observation must deeply snapshot authority evidence'
  );
}

const missingEvidence = observePresentationFrame(
  session(),
  frame({ frameEvidence: null })
);
assert.equal(missingEvidence.session, null);
assert.equal(missingEvidence.result?.ok, false);
if (missingEvidence.result && !missingEvidence.result.ok) {
  assert.equal(missingEvidence.result.error.code, 'preview_unavailable');
  assert.equal(missingEvidence.result.error.path, 'frameEvidence');
}

const milestoneResult = observePresentationFrame(
  session('frame', 'preview'),
  frame()
);
assert.equal(milestoneResult.result?.ok, true);
if (milestoneResult.result?.ok) {
  assert.equal(milestoneResult.result.data.review, 'preview');
  assert.equal(milestoneResult.result.data.purpose, 'preview');
  assert.equal(milestoneResult.result.data.milestone, 'specialists');
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
