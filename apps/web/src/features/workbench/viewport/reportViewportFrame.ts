import type { MutableRefObject } from 'react';

import { captureViewportFrameEvidence } from './evidence';
import type { ViewportRuntime } from './viewportRuntime';
import type {
  ViewportPresentationFrame
} from './viewportTypes';

const REVIEW_FRAME_EPSILON_SECONDS = 0.000001;

export interface ViewportPresentationState {
  projectId: string;
  revision: string;
  camera: ViewportPresentationFrame['camera'];
  clipId: string | null;
  playing: boolean;
  timeSeconds: number;
}

interface ReportViewportFrameInput {
  frameNonce: number;
  presentationNonce: number | null;
  presentation: ViewportPresentationState;
  runtime: ViewportRuntime | null;
  evidenceCaptureRef: MutableRefObject<number | null>;
  onPresented: (frame: ViewportPresentationFrame) => void;
}

export const reportViewportFrame = ({
  frameNonce,
  presentationNonce,
  presentation,
  runtime,
  evidenceCaptureRef,
  onPresented
}: ReportViewportFrameInput): void => {
  if (presentationNonce === null) return;
  const readiness = runtime?.projection?.readiness;
  const frame = {
    presentationNonce,
    frameNonce,
    ...presentation,
    cameraMatrix: runtime?.camera.matrixWorld.elements.slice() ?? [],
    projectionStatus: readiness?.status ?? 'pending',
    projectionError: readiness?.error ?? null
  } as const;
  const requiresEvidence =
    runtime !== null &&
    readiness?.status === 'ready' &&
    !presentation.playing &&
    Math.abs(presentation.timeSeconds) <= REVIEW_FRAME_EPSILON_SECONDS;
  if (!requiresEvidence) {
    onPresented({
      ...frame,
      frameEvidence: null,
      frameEvidenceError: null
    });
    return;
  }
  if (evidenceCaptureRef.current === presentationNonce) return;
  evidenceCaptureRef.current = presentationNonce;
  void captureViewportFrameEvidence(runtime.renderer).then((capture) => {
    if (evidenceCaptureRef.current === presentationNonce) {
      evidenceCaptureRef.current = null;
    }
    onPresented({
      ...frame,
      frameEvidence: capture.ok ? capture.evidence : null,
      frameEvidenceError: capture.ok ? null : capture.error
    });
  });
};
