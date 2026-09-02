'use client';

import {
  useCallback,
  useRef
} from 'react';

import type { AssetProject } from '@ashfox/engine-core';

import {
  isValidVisualReviewReceipt,
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
  project: AssetProject;
  visualReviews: readonly VisualReviewReceipt[];
  observations: PresentationObservationStore;
  onRecordVisualReview: (receipt: VisualReviewReceipt) => void;
}

export const useVisualReviewController = ({
  project,
  visualReviews,
  observations,
  onRecordVisualReview
}: UseVisualReviewControllerInput) => {
  const document = project.document;
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
      project,
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
  }, [document.revision, observations, onRecordVisualReview, project]);

  const getVisualReviews = useCallback((
    requestedProjectId: string,
    requestedRevision: string
  ): readonly VisualReviewReceipt[] =>
    visualReviewsForRevision(
      receiptsRef.current,
      requestedProjectId,
      requestedRevision
    ).filter((receipt) => isValidVisualReviewReceipt(receipt, project)), [project]);

  return { review, getVisualReviews };
};
