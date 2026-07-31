import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from './presentationReview';
import type {
  PresentRequest,
  PresentResult,
  ViewPresentationRequest
} from './types';
import {
  nextVisualReview
} from './visualReviewPlan';

interface PresentAgentProjectInput {
  request: PresentRequest;
  document: ProjectDocument;
  report: ValidationReport;
  visualReviews: readonly VisualReviewReceipt[];
  review: (
    request: Exclude<PresentRequest, { review: 'next' }>
  ) => Promise<PresentResult>;
  present: (
    request: ViewPresentationRequest
  ) => Promise<PresentResult>;
}

export const presentAgentProject = ({
  request,
  document,
  report,
  visualReviews,
  review,
  present
}: PresentAgentProjectInput): Promise<PresentResult> => {
  if (request.review !== 'next') return review(request);
  const readiness = evaluateProductionReadiness(document, report);
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
    (receipt) => receipt.verdict === 'rejected'
  );
  if (rejected) {
    return Promise.resolve({
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        path: 'review',
        expected:
          `revise rejected visual issues: ${rejected.issues.join(', ')}`
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
    ...nextReview,
    timeSeconds: 0
  });
};
