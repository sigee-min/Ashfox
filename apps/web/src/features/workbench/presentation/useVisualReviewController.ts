'use client';

import {
  useCallback,
  useRef
} from 'react';

import {
  recordVisualReview,
  visualReviewReceiptFrom,
  visualReviewsForRevision,
  type VisualReviewReceipt
} from '../../agent/presentationReview';
import type {
  PresentRequest,
  PresentResult,
  PresentSuccess
} from '../../agent/types';
import type {
  PresentationObservationStore
} from './usePresentationSession';

interface UseVisualReviewControllerInput {
  projectId: string;
  revision: string;
  observations: PresentationObservationStore;
}

export const useVisualReviewController = ({
  projectId,
  revision,
  observations
}: UseVisualReviewControllerInput) => {
  const receiptsRef = useRef<readonly VisualReviewReceipt[]>([]);

  const review = useCallback((
    request: Exclude<PresentRequest, { review: 'next' }>
  ): Promise<PresentResult> => {
    const observation = observations.current.get(request.frameNonce);
    if (!observation) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'not_found',
          path: 'frameNonce',
          expected:
            'the most recently observed pending review frame'
        }
      });
    }
    if (observation.revision !== revision) {
      observations.current = new Map();
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'stale_revision',
          path: 'revision',
          expected: observation.revision
        }
      });
    }
    observations.current = new Map();
    const reviewed: PresentSuccess = {
      ...observation,
      data: {
        ...observation.data,
        review: request.review,
        verdict:
          request.review === 'accept'
            ? 'accepted'
            : 'rejected',
        issues:
          request.review === 'reject'
            ? request.issues
            : []
      }
    };
    const receipt = visualReviewReceiptFrom(projectId, reviewed);
    if (receipt) {
      receiptsRef.current = recordVisualReview(
        receiptsRef.current,
        receipt
      );
    }
    return Promise.resolve(reviewed);
  }, [observations, projectId, revision]);

  const getVisualReviews = useCallback((
    requestedProjectId: string,
    requestedRevision: string
  ): readonly VisualReviewReceipt[] =>
    visualReviewsForRevision(
      receiptsRef.current,
      requestedProjectId,
      requestedRevision
    ), []);

  return { review, getVisualReviews };
};
