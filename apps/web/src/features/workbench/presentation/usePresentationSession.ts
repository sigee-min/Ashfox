'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import type {
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  PresentResult,
  PresentSuccess,
  ViewPresentationRequest
} from '../../agent/types';
import type {
  ViewportPresentationFrame
} from '../viewport/viewportTypes';
import {
  createPresentationSession,
  presentationTimeoutMs,
  resolvePresentationRequest
} from './presentationRequest';
import {
  observePresentationFrame,
  presentationCancellationResult,
  presentationTimeoutResult,
  stalePresentationResult,
  snapshotPresentationObservation,
  type PresentationPlaybackEffect,
  type PresentationSession
} from './presentationSession';

interface PresentationViewRequest {
  clipId: string | null;
  camera: ViewPresentationRequest['camera'];
}

interface UsePresentationSessionInput {
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

export interface PresentationObservationStore {
  current: ReadonlyMap<number, PresentSuccess>;
}

export const usePresentationSession = ({
  document,
  prepareView,
  setPlayhead,
  setPlaying
}: UsePresentationSessionInput) => {
  const [presentationNonce, setPresentationNonce] = useState(0);
  const pendingRef = useRef<PendingPresentation | null>(null);
  const nextNonceRef = useRef(0);
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
        [
          result.data.frameNonce,
          snapshotPresentationObservation(result)
        ]
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
    if (transition.session) pending.session = transition.session;
    if (transition.result) finish(pending, transition.result);
  }, [applyPlaybackEffect, finish]);

  const present = useCallback((
    request: ViewPresentationRequest
  ): Promise<PresentResult> => {
    const resolution = resolvePresentationRequest(document, request);
    if (!resolution.ok) return Promise.resolve(resolution.result);
    const resolved = resolution.request;
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
      clipId: resolved.clip?.id ?? null,
      camera: request.camera
    });
    setPlayhead(resolved.timeSeconds);
    setPlaying(request.mode === 'cycle');
    setPresentationNonce(nonce);

    return new Promise<PresentResult>((resolve) => {
      const pending: PendingPresentation = {
        session: createPresentationSession(
          document,
          request,
          resolved,
          nonce
        ),
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
      }, presentationTimeoutMs(request, resolved.clip));
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

  return {
    presentationNonce,
    present,
    onPresented,
    observations: observationsRef
  };
};
