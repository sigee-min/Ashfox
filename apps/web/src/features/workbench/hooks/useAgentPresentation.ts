'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  analyzeAnimationPreview,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createCycleObservation,
  cyclePresentationTimeoutMs
} from '../../agent/cycleObservation';
import {
  recordVisualReview,
  visualReviewReceiptFrom,
  visualReviewsForRevision,
  type VisualReviewReceipt
} from '../../agent/presentationReview';
import type {
  PresentRequest,
  PresentResult,
  PresentSuccess,
  ViewPresentationRequest
} from '../../agent/types';
import type {
  ViewportPresentationFrame
} from '../viewport/viewportTypes';
import {
  observePresentationFrame,
  presentationCancellationResult,
  presentationTimeoutResult,
  stalePresentationResult,
  type PresentationPlaybackEffect,
  type PresentationSession
} from '../presentation/presentationSession';

const FRAME_PRESENTATION_TIMEOUT_MS = 5_000;

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

interface PendingPresentation {
  session: PresentationSession;
  timeout: number;
  resolve: (result: PresentResult) => void;
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
  const [presentationNonce, setPresentationNonce] = useState(0);
  const pendingRef = useRef<PendingPresentation | null>(null);
  const nextNonceRef = useRef(0);
  const receiptsRef = useRef<readonly VisualReviewReceipt[]>([]);
  const observationsRef =
    useRef<ReadonlyMap<number, PresentSuccess>>(new Map());
  const currentDocumentRef = useRef({
    id: document.id,
    revision: document.revision
  });
  currentDocumentRef.current = {
    id: document.id,
    revision: document.revision
  };

  const applyPlaybackEffect = useCallback((
    effect: PresentationPlaybackEffect
  ): void => {
    if (effect === 'stop' || effect === 'stop_and_rewind') {
      setPlaying(false);
    }
    if (effect === 'rewind' || effect === 'stop_and_rewind') {
      setPlayhead(0);
    }
  }, [setPlayhead, setPlaying]);

  const finish = useCallback((
    pending: PendingPresentation,
    result: PresentResult
  ): void => {
    if (pendingRef.current !== pending) return;
    pendingRef.current = null;
    window.clearTimeout(pending.timeout);
    setPresentationNonce(0);
    if (result.ok && result.data.verdict === 'pending') {
      observationsRef.current = new Map([
        [result.data.frameNonce, result]
      ]);
    }
    pending.resolve(result);
  }, []);

  const onPresented = useCallback((
    frame: ViewportPresentationFrame
  ): void => {
    const pending = pendingRef.current;
    if (!pending) return;
    const transition = observePresentationFrame(
      pending.session,
      frame
    );
    applyPlaybackEffect(transition.playbackEffect);
    if (transition.session) {
      pending.session = transition.session;
    }
    if (transition.result) finish(pending, transition.result);
  }, [applyPlaybackEffect, finish]);

  const present = useCallback((
    request: ViewPresentationRequest
  ): Promise<PresentResult> => {
    const clip = request.clipId === null
      ? null
      : document.animations[request.clipId];
    if (request.clipId !== null && !clip) {
      return Promise.resolve({
        ok: false,
        revision: document.revision,
        error: {
          code: 'not_found',
          path: 'clipId',
          expected: 'existing animation clip ID'
        }
      });
    }
    const timeSeconds = clip
      ? Math.min(request.timeSeconds, clip.durationSeconds)
      : 0;
    const previewIssues = clip
      ? analyzeAnimationPreview(clip)
      : [];
    if (previewIssues.length > 0) {
      return Promise.resolve({
        ok: false,
        revision: document.revision,
        error: {
          code: 'preview_unfaithful',
          path: `animations.${clip?.id ?? ''}`,
          expected: 'animation features supported by the live renderer'
        }
      });
    }

    const previous = pendingRef.current;
    if (previous) {
      setPlaying(false);
      finish(
        previous,
        presentationCancellationResult(
          document.revision,
          'one presentation request at a time'
        )
      );
    }

    const nonce = nextNonceRef.current + 1;
    nextNonceRef.current = nonce;
    observationsRef.current = new Map();
    prepareView({
      clipId: clip?.id ?? null,
      camera: request.camera
    });
    setPlayhead(timeSeconds);
    setPlaying(request.mode === 'cycle');
    setPresentationNonce(nonce);

    return new Promise<PresentResult>((resolve) => {
      const session: PresentationSession = {
        nonce,
        projectId: document.id,
        sourceRevision: document.revision,
        mode: request.mode,
        camera: request.camera,
        clipId: clip?.id ?? null,
        timeSeconds,
        cycle:
          clip && request.mode === 'cycle'
            ? createCycleObservation(
                clip.durationSeconds,
                clip.fps
              )
            : null,
        phase: 'observing',
        previewIssues
      };
      const timeoutMs =
        request.mode === 'cycle' && clip
          ? cyclePresentationTimeoutMs(clip.durationSeconds)
          : FRAME_PRESENTATION_TIMEOUT_MS;
      const pending: PendingPresentation = {
        session,
        timeout: 0,
        resolve
      };
      pending.timeout = window.setTimeout(() => {
        if (pendingRef.current !== pending) return;
        setPlaying(false);
        finish(
          pending,
          presentationTimeoutResult(
            pending.session,
            currentDocumentRef.current.revision
          )
        );
      }, timeoutMs);
      pendingRef.current = pending;
    });
  }, [
    document.animations,
    document.id,
    document.revision,
    finish,
    prepareView,
    setPlayhead,
    setPlaying
  ]);

  const review = useCallback((
    request: Exclude<PresentRequest, { review: 'next' }>
  ): Promise<PresentResult> => {
    const observation =
      observationsRef.current.get(request.frameNonce);
    if (!observation) {
      return Promise.resolve({
        ok: false,
        revision: document.revision,
        error: {
          code: 'not_found',
          path: 'frameNonce',
          expected:
            'the most recently observed pending review frame'
        }
      });
    }
    if (observation.revision !== document.revision) {
      observationsRef.current = new Map();
      return Promise.resolve({
        ok: false,
        revision: document.revision,
        error: {
          code: 'stale_revision',
          path: 'revision',
          expected: observation.revision
        }
      });
    }
    observationsRef.current = new Map();
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
    const receipt = visualReviewReceiptFrom(
      document.id,
      reviewed
    );
    if (receipt) {
      receiptsRef.current = recordVisualReview(
        receiptsRef.current,
        receipt
      );
    }
    return Promise.resolve(reviewed);
  }, [document.id, document.revision]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) {
      observationsRef.current = new Map();
      return;
    }
    if (
      pending.session.projectId === document.id &&
      pending.session.sourceRevision === document.revision
    ) {
      return;
    }
    setPlaying(false);
    observationsRef.current = new Map();
    finish(
      pending,
      stalePresentationResult(
        document.revision,
        pending.session.sourceRevision
      )
    );
  }, [document.id, document.revision, finish, setPlaying]);

  useEffect(() => () => {
    observationsRef.current = new Map();
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    window.clearTimeout(pending.timeout);
    pending.resolve(
      presentationCancellationResult(
        currentDocumentRef.current.revision,
        'mounted viewport'
      )
    );
  }, []);

  const getVisualReviews = useCallback((
    projectId: string,
    revision: string
  ): readonly VisualReviewReceipt[] =>
    visualReviewsForRevision(
      receiptsRef.current,
      projectId,
      revision
    ), []);

  return {
    presentationNonce,
    present,
    review,
    onPresented,
    getVisualReviews
  };
};
