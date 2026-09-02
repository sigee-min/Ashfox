import assert from 'node:assert/strict';

import { validateProjectDocument } from '@ashfox/engine-core';

import { createOperationLease } from '../../src/application/operationLease';
import { captureAgentProject } from '../../src/features/agent/captureAgentProject';
import { requiredVisualReviews } from '../../src/features/agent/visualReviewPlan';
import {
  createArtifactBinding,
  type ArtifactFile
} from '../../src/features/files/artifactFile';
import { createWorkbenchProject } from '../fixtures/project';
import { createVisualReviewReceiptFixture } from '../fixtures/review';

export const test = (async (): Promise<void> => {
  const project = createWorkbenchProject();
  const reviews = requiredVisualReviews(project.document).map((review, index) =>
    createVisualReviewReceiptFixture(project, {
      mode: review.mode,
      camera: review.camera,
      clipId: review.clipId,
      frameNonce: index + 1
    })
  );
  const bytes = new Uint8Array([1, 2, 3]);
  const binding = await createArtifactBinding(project, bytes, 'capture');
  if (!binding.lineage) throw new Error('capture binding requires lineage');
  const forgedHash = `sha256:${'0'.repeat(64)}`;
  const forged: ArtifactFile & {
    readonly width: number;
    readonly height: number;
    readonly frameCount: number;
    readonly eventCount: number;
    readonly fps: number;
  } = {
    ...binding,
    contentHash: forgedHash,
    lineage: {
      ...binding.lineage,
      artifactSha256: forgedHash,
      captureSha256: forgedHash
    },
    kind: 'build',
    name: 'forged.gif',
    contentType: 'image/gif',
    bytes,
    width: 1,
    height: 1,
    frameCount: 1,
    eventCount: 1,
    fps: 1
  };
  const operationLease = createOperationLease();
  const lease = operationLease.tryAcquire('agent.capture');
  if (!lease) throw new Error('capture test could not acquire its operation lease');
  const result = await captureAgentProject({
    request: { kind: 'build' },
    project,
    report: validateProjectDocument(project.document),
    visualReviews: reviews,
    currentProject: () => project,
    capture: async () => ({ ok: true, operationId: 1, result: forged }),
    lease
  });
  assert.equal(result.ok, false,
    'agent capture must reject bytes that do not match the exact artifact hash');
  if (!result.ok) assert.equal(result.error.code, 'capture_failed');
  lease.release();

  console.log('agent capture artifact authority ok');
})();
