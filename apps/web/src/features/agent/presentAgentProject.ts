import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from '../../application/visualReviewReceipt';
import type {
  PresentRequest,
  PresentResult,
  VisualReviewDecisionRequest,
  ViewPresentationRequest
} from './types';
import {
  presentedReviewChecks
} from '../../application/visualReviewContract';
import {
  nextVisualReview
} from './visualReviewPlan';
import {
  pendingIntentProgramBlock
} from './intentProgramProposalGate';

interface PresentAgentProjectInput {
  request: PresentRequest;
  document: ProjectDocument;
  report: ValidationReport;
  visualReviews: readonly VisualReviewReceipt[];
  review: (
    request: VisualReviewDecisionRequest
  ) => Promise<PresentResult>;
  present: (
    request: ViewPresentationRequest
  ) => Promise<PresentResult>;
}

const previewCamera = (
  request: Extract<PresentRequest, { review: 'preview' }>
): ViewPresentationRequest['camera'] =>
  request.camera ??
    (request.milestone === 'specialists' ? 'front' : 'perspective');

export const presentAgentProject = ({
  request,
  document,
  report,
  visualReviews,
  review,
  present
}: PresentAgentProjectInput): Promise<PresentResult> => {
  const proposalBlock = pendingIntentProgramBlock(document);
  if (proposalBlock) {
    return Promise.resolve({
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        ...proposalBlock
      }
    });
  }
  if (request.review === 'accept' || request.review === 'reject') {
    return review(request);
  }
  const readiness = evaluateProductionReadiness(document, report);
  if (request.review === 'preview') {
    if (!document.authoringProfile) {
      return Promise.resolve({
        ok: false,
        revision: document.revision,
        error: {
          code: 'invalid_state',
          path: 'authoringProfile',
          expected: 'a configured archetype and specialist profile before preview'
        }
      });
    }
    if (readiness.counts.visibleGeometry === 0) {
      return Promise.resolve({
        ok: false,
        revision: document.revision,
        error: {
          code: 'invalid_state',
          path: 'model',
          expected: 'visible milestone geometry before preview'
        }
      });
    }
    const milestone = request.milestone ?? null;
    const camera = previewCamera(request);
    return present({
      review: 'preview',
      purpose: 'preview',
      milestone,
      mode: 'frame',
      camera,
      clipId: null,
      timeSeconds: 0,
      reviewChecks: presentedReviewChecks(
        document,
        camera,
        false,
        null,
        milestone
      )
    });
  }
  if (!readiness.mechanicallyReady) {
    return Promise.resolve({
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        path: readiness.firstBlockingFinding?.path ?? '$',
        expected:
          readiness.firstBlockingFinding?.fix ??
          'mechanically ready project before visual review'
      }
    });
  }
  const rejected = visualReviews.find(
    (receipt) =>
      receipt.observation.data.purpose === 'delivery' &&
      receipt.decision.verdict === 'rejected'
  );
  if (rejected) {
    return Promise.resolve({
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        path: 'review',
        expected:
          `revise rejected visual issues: ${rejected.decision.issues.join(', ')}`
      }
    });
  }
  const nextReview = nextVisualReview(
    document,
    readiness,
    visualReviews
  );
  if (!nextReview) {
    return Promise.resolve({
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        path: 'review',
        expected:
          'a remaining revision-bound visual review from inspect'
      }
    });
  }
  return present({
    review: 'next',
    purpose: 'delivery',
    milestone: null,
    ...nextReview,
    timeSeconds: 0,
    reviewChecks: presentedReviewChecks(
      document,
      nextReview.camera,
      nextReview.mode === 'cycle',
      nextReview.clipId,
      null
    )
  });
};
