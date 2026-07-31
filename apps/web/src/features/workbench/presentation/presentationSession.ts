import type {
  AnimationPreviewIssue
} from '@ashfox/engine-core';

import {
  advanceCycleObservation,
  type CycleObservation
} from '../../agent/cycleObservation';
import type {
  PresentResult,
  ViewPresentationRequest
} from '../../agent/types';
import type {
  CameraMode
} from '../../../rendering/cameraPresets';
import type {
  ViewportPresentationFrame
} from '../viewport/viewportTypes';

const FRAME_EPSILON_SECONDS = 0.000001;

export interface PresentationSession {
  nonce: number;
  projectId: string;
  sourceRevision: string;
  mode: ViewPresentationRequest['mode'];
  camera: CameraMode;
  clipId: string | null;
  timeSeconds: number;
  cycle: CycleObservation | null;
  phase: 'observing' | 'closing';
  previewIssues: readonly AnimationPreviewIssue[];
}

export type PresentationPlaybackEffect =
  | 'none'
  | 'stop'
  | 'rewind'
  | 'stop_and_rewind';

export interface PresentationTransition {
  session: PresentationSession | null;
  result: PresentResult | null;
  playbackEffect: PresentationPlaybackEffect;
}

const pending = (
  session: PresentationSession,
  playbackEffect: PresentationPlaybackEffect = 'none'
): PresentationTransition => ({
  session,
  result: null,
  playbackEffect
});

const failure = (
  revision: string,
  code: 'preview_unavailable' | 'stale_revision',
  path: string,
  expected: string
): PresentationTransition => ({
  session: null,
  result: {
    ok: false,
    revision,
    error: { code, path, expected }
  },
  playbackEffect: 'stop'
});

const success = (
  session: PresentationSession,
  frame: ViewportPresentationFrame,
  completedCycles: number
): PresentationTransition => ({
  session: null,
  result: {
    ok: true,
    revision: frame.revision,
    data: {
      review: 'next',
      verdict: 'pending',
      issues: [],
      frameNonce: frame.frameNonce,
      mode: session.mode,
      camera: frame.camera,
      cameraMatrix: frame.cameraMatrix,
      clipId: frame.clipId,
      playing: frame.playing,
      observedTimeSeconds: frame.timeSeconds,
      completedCycles,
      previewIssues: session.previewIssues
    }
  },
  playbackEffect: 'none'
});

export const observePresentationFrame = (
  session: PresentationSession,
  frame: ViewportPresentationFrame
): PresentationTransition => {
  if (session.nonce !== frame.presentationNonce) {
    return pending(session);
  }
  if (
    frame.projectId !== session.projectId ||
    frame.revision !== session.sourceRevision
  ) {
    return failure(
      frame.revision,
      'stale_revision',
      'revision',
      session.sourceRevision
    );
  }
  if (frame.projectionStatus === 'failed') {
    return failure(
      frame.revision,
      'preview_unavailable',
      'textures',
      frame.projectionError ??
        'all viewport textures decoded successfully'
    );
  }
  if (
    frame.projectionStatus !== 'ready' ||
    frame.camera !== session.camera ||
    frame.clipId !== session.clipId
  ) {
    return pending(session);
  }
  if (session.mode === 'frame') {
    if (
      frame.playing ||
      Math.abs(frame.timeSeconds - session.timeSeconds) >
        FRAME_EPSILON_SECONDS
    ) {
      return pending(session);
    }
    return success(session, frame, 0);
  }
  if (session.phase === 'closing') {
    if (frame.playing) return pending(session);
    if (frame.timeSeconds > FRAME_EPSILON_SECONDS) {
      return pending(session, 'rewind');
    }
    return success(session, frame, 1);
  }
  if (!session.cycle) return pending(session);

  const advanced = advanceCycleObservation(
    session.cycle,
    frame.timeSeconds
  );
  const next = {
    ...session,
    cycle: advanced.observation
  };
  if (!frame.playing) {
    if (
      frame.timeSeconds +
        advanced.observation.toleranceSeconds <
          advanced.observation.durationSeconds ||
      !advanced.complete
    ) {
      return pending(next);
    }
    return pending(
      { ...next, phase: 'closing' },
      'rewind'
    );
  }
  if (!advanced.complete) return pending(next);
  return pending(
    { ...next, phase: 'closing' },
    'stop_and_rewind'
  );
};

export const presentationTimeoutResult = (
  session: PresentationSession,
  revision: string
): PresentResult => ({
  ok: false,
  revision,
  error: {
    code: 'render_timeout',
    path: '$',
    expected:
      session.mode === 'cycle'
        ? 'one observed animation cycle and closing frame'
        : 'a rendered viewport frame within 5 seconds'
  }
});

export const presentationCancellationResult = (
  revision: string,
  expected: string
): PresentResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_state',
    path: '$',
    expected
  }
});

export const stalePresentationResult = (
  revision: string,
  expectedRevision: string
): PresentResult => ({
  ok: false,
  revision,
  error: {
    code: 'stale_revision',
    path: 'revision',
    expected: expectedRevision
  }
});
