'use client';

import {
  useCallback,
  useRef
} from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  recordVisualReview,
  visualReviewReceiptFrom,
  visualReviewsForRevision,
  type VisualReviewReceipt
} from '../../../application/review';
import { AGENT_ACTOR_ID } from '../../agent/agentIdentity';
import type {
  PresentResult,
  VisualReviewDecisionRequest
} from '../../agent/types';
import type {
  PresentationObservationStore
} from './session';
import {
  resolvePresentationObservation,
  reviewPresentationObservation
} from './visualReviewDecision';

interface UseVisualReviewControllerInput {
  document: ProjectDocument;
  visualReviews: readonly VisualReviewReceipt[];
  observations: PresentationObservationStore;
  onRecordVisualReview: (receipt: VisualReviewReceipt) => void;
}

export const useVisualReviewController = ({
  document,
  visualReviews,
  observations,
  onRecordVisualReview
}: UseVisualReviewControllerInput) => {
  const receiptsRef = useRef<readonly VisualReviewReceipt[]>(visualReviews);
  receiptsRef.current = visualReviews;

  const review = useCallback((
    request: VisualReviewDecisionRequest
  ): Promise<PresentResult> => {
    const resolved = resolvePresentationObservation(
      observations.current,
      request.frameNonce,
      document.revision
    );
    if (!resolved.ok) {
      if (resolved.clear) observations.current = new Map();
      return Promise.resolve(resolved.result);
    }
    const reviewed = reviewPresentationObservation(
      resolved.observation,
      request
    );
    if (!reviewed.ok) return Promise.resolve(reviewed);
    observations.current = new Map();
    const receipt = visualReviewReceiptFrom(
      document,
      resolved.observation,
      reviewed,
      {
        actorId: AGENT_ACTOR_ID,
        recordedAt: new Date().toISOString()
      }
    );
    if (receipt) {
      receiptsRef.current = recordVisualReview(
        receiptsRef.current,
        receipt
      );
      onRecordVisualReview(receipt);
    }
    return Promise.resolve(reviewed);
  }, [document, observations, onRecordVisualReview]);

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
