'use client';

import type {
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from '../../agent/presentationReview';
import type {
  PresentRequest,
  PresentResult,
  ViewPresentationRequest
} from '../../agent/types';
import {
  usePresentationSession
} from '../presentation/usePresentationSession';
import {
  useVisualReviewController
} from '../presentation/useVisualReviewController';
import type {
  ViewportPresentationFrame
} from '../viewport/viewportTypes';

interface PresentationViewRequest {
  clipId: string | null;
  camera: ViewPresentationRequest['camera'];
}

interface UseAgentPresentationInput {
  document: ProjectDocument;
  prepareView: (request: PresentationViewRequest) => void;
  setPlayhead: (timeSeconds: number) => void;
  setPlaying: (playing: boolean) => void;
}

interface AgentPresentationController {
  presentationNonce: number;
  present: (request: ViewPresentationRequest) => Promise<PresentResult>;
  review: (
    request: Exclude<PresentRequest, { review: 'next' }>
  ) => Promise<PresentResult>;
  onPresented: (frame: ViewportPresentationFrame) => void;
  getVisualReviews: (
    projectId: string,
    revision: string
  ) => readonly VisualReviewReceipt[];
}

export const useAgentPresentation = ({
  document,
  prepareView,
  setPlayhead,
  setPlaying
}: UseAgentPresentationInput): AgentPresentationController => {
  const session = usePresentationSession({
    document,
    prepareView,
    setPlayhead,
    setPlaying
  });
  const reviews = useVisualReviewController({
    projectId: document.id,
    revision: document.revision,
    observations: session.observations
  });

  return {
    presentationNonce: session.presentationNonce,
    present: session.present,
    review: reviews.review,
    onPresented: session.onPresented,
    getVisualReviews: reviews.getVisualReviews
  };
};
