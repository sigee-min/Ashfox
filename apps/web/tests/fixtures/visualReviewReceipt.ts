import type {
  ProjectDocument
} from '@ashfox/engine-core';

import {
  visualReviewReceiptFrom,
  type VisualReviewReceipt
} from '../../src/application/visualReviewReceipt';
import type {
  PresentSuccess,
  PresentedReviewCheck,
  VisualReviewIssue,
  VisualReviewMilestone
} from '../../src/features/agent/types';
import {
  presentedReviewChecks
} from '../../src/application/visualReviewContract';
import type {
  PixelFrameEvidence
} from '../../src/rendering/pixelFrameEvidence';
import { FRAME_EVIDENCE_FIXTURE } from './frameEvidence';

const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
] as const;

interface VisualReviewReceiptFixtureInput {
  revision?: string;
  purpose?: 'delivery' | 'preview';
  milestone?: VisualReviewMilestone | null;
  mode?: 'frame' | 'cycle';
  camera?: PresentSuccess['data']['camera'];
  cameraMatrix?: readonly number[];
  frameEvidence?: PixelFrameEvidence;
  clipId?: string | null;
  observedTimeSeconds?: number;
  completedCycles?: number;
  frameNonce?: number;
  verdict?: 'accepted' | 'rejected';
  issues?: readonly VisualReviewIssue[];
  reviewChecks?: readonly PresentedReviewCheck[];
  failedCheckIds?: readonly string[];
  recordedAt?: string;
}

export const createVisualReviewReceiptFixture = (
  sourceDocument: ProjectDocument,
  input: VisualReviewReceiptFixtureInput = {}
): VisualReviewReceipt => {
  const revision = input.revision ?? sourceDocument.revision;
  const document = revision === sourceDocument.revision
    ? sourceDocument
    : { ...sourceDocument, revision };
  const purpose = input.purpose ?? 'delivery';
  const mode = input.mode ?? 'frame';
  const frameNonce = input.frameNonce ?? 1;
  const camera = input.camera ?? 'perspective';
  const milestone = purpose === 'preview'
    ? input.milestone ?? null
    : null;
  const clipId = mode === 'cycle'
    ? input.clipId ?? Object.keys(document.animations)[0] ?? 'clip-idle'
    : null;
  const reviewChecks = input.reviewChecks ?? presentedReviewChecks(
    document,
    camera,
    mode === 'cycle',
    clipId,
    milestone
  );
  const verdict = input.verdict ?? 'accepted';
  const failedCheckIds = verdict === 'rejected'
    ? input.failedCheckIds ?? reviewChecks.slice(0, 1).map((check) => check.id)
    : [];
  const issues = verdict === 'rejected'
    ? input.issues ?? (
        failedCheckIds.length > 0
          ? reviewChecks
              .filter((check) => failedCheckIds.includes(check.id))
              .map((check) => check.issue)
          : ['other']
      )
    : [];
  const observation: PresentSuccess = {
    ok: true,
    revision,
    data: {
      review: purpose === 'delivery' ? 'next' : 'preview',
      purpose,
      milestone,
      verdict: 'pending',
      issues: [],
      acknowledgedCheckIds: [],
      failedCheckIds: [],
      frameNonce,
      mode,
      camera,
      cameraMatrix: input.cameraMatrix ?? IDENTITY_MATRIX,
      frameEvidence:
        input.frameEvidence ?? structuredClone(FRAME_EVIDENCE_FIXTURE),
      clipId,
      playing: false,
      observedTimeSeconds: input.observedTimeSeconds ?? 0,
      completedCycles: mode === 'cycle'
        ? input.completedCycles ?? 1
        : 0,
      previewIssues: [],
      reviewChecks
    }
  };
  const acknowledgedCheckIds = verdict === 'accepted'
    ? reviewChecks.map((check) => check.id)
    : failedCheckIds;
  const reviewed: PresentSuccess = {
    ...observation,
    data: {
      ...observation.data,
      review: verdict === 'accepted' ? 'accept' : 'reject',
      verdict,
      issues,
      acknowledgedCheckIds,
      failedCheckIds
    }
  };
  const receipt = visualReviewReceiptFrom(
    document,
    observation,
    reviewed,
    {
      actorId: 'test-agent',
      recordedAt: input.recordedAt ?? new Date(
        Date.UTC(2026, 7, 6, 0, 0, 0, Math.min(frameNonce, 999))
      ).toISOString()
    }
  );
  if (!receipt) throw new Error('Visual review fixture is invalid.');
  return receipt;
};
