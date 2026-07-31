import assert from 'node:assert/strict';

import {
  validateProjectDocument,
  type CommandReceipt,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import {
  createOperationLease,
  type OperationLeaseToken
} from '../src/application/operationLease';
import {
  captureAgentProject
} from '../src/features/agent/captureAgentProject';
import type {
  VisualReviewReceipt
} from '../src/features/agent/presentationReview';
import {
  requiredVisualReviews
} from '../src/features/agent/visualReviewPlan';
import type {
  GifCaptureFile
} from '../src/features/capture/gifCaptureFile';
import type {
  ResultCaptureFile
} from '../src/features/capture/resultCaptureFile';
import type {
  CaptureArtifactRequest
} from '../src/features/files/captureArtifactRequest';
import type {
  ArtifactFile
} from '../src/features/files/artifactFile';
import type {
  FileOperationRunResult
} from '../src/features/files/useFileOperation';

const document = structuredClone(
  createGltfProject('glb', 'embedded')
);
document.intent = {
  subject: 'Crate',
  forward: 'north',
  grounding: 'free',
  features: ['Confirm the crate silhouette.']
};
const sourceIdle = document.animations['clip-idle'];
const idleChannel = sourceIdle.channels['channel-root-rotation'];
document.animations = {
  idle: {
    ...sourceIdle,
    id: 'idle',
    name: 'idle',
    channels: {
      ...sourceIdle.channels,
      'channel-root-rotation': {
        ...idleChannel,
        keys: idleChannel.keys.map((key, index) =>
          index === idleChannel.keys.length - 1
            ? { ...key, value: idleChannel.keys[0].value }
            : key
        )
      }
    }
  }
};

const reviews: readonly VisualReviewReceipt[] =
  requiredVisualReviews(document).map((review, index) => ({
    projectId: document.id,
    revision: document.revision,
    mode: review.mode,
    camera: review.camera,
    clipId: review.clipId,
    observedTimeSeconds: 0,
    completedCycles: review.mode === 'cycle' ? 1 : 0,
    frameNonce: index + 1,
    verdict: 'accepted',
    issues: []
  }));

const captureArtifact = (
  kind: CaptureArtifactRequest['kind'],
  source = document
): ArtifactFile => {
  const common = {
    kind,
    name: `crate-${kind}.${kind === 'result' ? 'png' : 'gif'}`,
    contentType: kind === 'result' ? 'image/png' : 'image/gif',
    bytes: new Uint8Array([1, 2, 3]),
    projectId: source.id,
    sourceRevision: source.revision,
    target: 'glb' as const,
    contentHash: 'sha256:test',
    width: kind === 'result' ? 1280 : 640,
    height: kind === 'result' ? 720 : 360
  };
  return kind === 'result'
    ? common as ResultCaptureFile
    : {
        ...common,
        frameCount: 20,
        eventCount: 2,
        fps: 10
      } as GifCaptureFile;
};

const successful = (
  artifact: ArtifactFile
): FileOperationRunResult<ArtifactFile> => ({
  ok: true,
  operationId: 1,
  result: artifact
});

const leaseForTest = (): OperationLeaseToken => {
  const lease = createOperationLease().tryAcquire('test.capture');
  assert.ok(lease);
  return lease;
};

const baseInput = (
  capture: (
    request: CaptureArtifactRequest,
    lease: OperationLeaseToken
  ) => Promise<FileOperationRunResult<ArtifactFile>>
) => ({
  request: { kind: 'result' } as const,
  document,
  report: validateProjectDocument(document),
  visualReviews: reviews,
  buildDocuments: [document],
  activity: [] as readonly CommandReceipt[],
  currentDocument: () => document,
  capture,
  lease: leaseForTest()
});

export const test = (async (): Promise<void> => {
{
  let calls = 0;
  const result = await captureAgentProject({
    ...baseInput(async () => {
      calls += 1;
      return successful(captureArtifact('result'));
    }),
    visualReviews: []
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'invalid_state');
    assert.equal(result.error.path, 'review');
  }
  assert.equal(calls, 0);
}

{
  let received: CaptureArtifactRequest | null = null;
  const result = await captureAgentProject({
    ...baseInput(async (request) => {
      received = request;
      return successful(captureArtifact('animation'));
    }),
    request: { kind: 'animation' }
  });
  assert.deepEqual(received, {
    kind: 'animation',
    clipId: 'idle',
    environment: 'studio',
    cameraMode: 'perspective'
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.artifact, {
      kind: 'animation',
      name: 'crate-animation.gif',
      contentType: 'image/gif',
      byteLength: 3,
      contentHash: 'sha256:test',
      width: 640,
      height: 360,
      frameCount: 20,
      eventCount: 2,
      fps: 10
    });
  }
}

{
  let calls = 0;
  const result = await captureAgentProject({
    ...baseInput(async () => {
      calls += 1;
      return successful(captureArtifact('animation'));
    }),
    request: { kind: 'animation', clipId: 'missing' }
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'invalid_request');
    assert.equal(result.error.path, 'clipId');
  }
  assert.equal(calls, 0);
}

{
  const prior = {
    ...document,
    revision: 'local-0000'
  };
  const foreign = {
    ...document,
    id: 'foreign-project',
    revision: 'local-9999'
  };
  const activity: readonly CommandReceipt[] = [{
    schemaVersion: 1,
    commandId: 'geometry',
    projectId: document.id,
    actorId: 'ashfox-agent',
    source: 'agent',
    summary: 'Shape assembled',
    beforeRevision: prior.revision,
    revision: document.revision,
    completedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 0,
    effects: {
      createdEntityIds: [],
      changedEntityIds: [],
      removedEntityIds: [],
      invalidated: ['scene']
    },
    findings: []
  }, {
    schemaVersion: 1,
    commandId: 'foreign',
    projectId: foreign.id,
    actorId: 'ashfox-agent',
    source: 'agent',
    summary: 'Foreign edit',
    beforeRevision: 'local-9998',
    revision: foreign.revision,
    completedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 0,
    effects: {
      createdEntityIds: [],
      changedEntityIds: [],
      removedEntityIds: [],
      invalidated: []
    },
    findings: []
  }];
  let received: CaptureArtifactRequest | null = null;
  const result = await captureAgentProject({
    ...baseInput(async (request) => {
      received = request;
      return successful(captureArtifact('build'));
    }),
    request: { kind: 'build' },
    buildDocuments: [foreign, prior, prior, document, foreign],
    activity
  });
  assert.equal(result.ok, true);
  assert.ok(received?.kind === 'build');
  if (received?.kind === 'build') {
    assert.deepEqual(
      received.documents.map((candidate) => candidate.revision),
      [prior.revision, document.revision]
    );
    assert.deepEqual(
      received.receipts.map((receipt) => receipt.commandId),
      ['geometry']
    );
  }
}

{
  let current: ProjectDocument = document;
  let finish:
    ((result: FileOperationRunResult<ArtifactFile>) => void) | undefined;
  const pending = captureAgentProject({
    ...baseInput(() =>
      new Promise((resolve) => {
        finish = resolve;
      })
    ),
    currentDocument: () => current
  });
  assert.ok(finish);
  current = { ...document, revision: 'local-0009' };
  finish(successful(captureArtifact('result')));
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'stale_revision');
    assert.equal(result.revision, 'local-0009');
  }
}

{
  const result = await captureAgentProject(
    baseInput(async () => ({
      ok: false,
      operationId: 4,
      code: 'cancelled',
      message: 'Capture cancelled'
    }))
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'cancelled');
}

{
  const wrongRevision = {
    ...document,
    revision: 'local-0008'
  };
  const result = await captureAgentProject(
    baseInput(async () =>
      successful(captureArtifact('result', wrongRevision))
    )
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'capture_failed');
}
})();
