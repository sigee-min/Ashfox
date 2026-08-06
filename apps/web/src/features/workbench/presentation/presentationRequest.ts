import {
  blockingAnimationPreviewIssues,
  type AnimationClip,
  type AnimationPreviewIssue,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createCycleObservation,
  cyclePresentationTimeoutMs
} from '../../agent/cycleObservation';
import type {
  PresentResult,
  ViewPresentationRequest
} from '../../agent/types';
import type {
  PresentationSession
} from './presentationSession';

const FRAME_PRESENTATION_TIMEOUT_MS = 5_000;

export interface ResolvedPresentationRequest {
  clip: AnimationClip | null;
  timeSeconds: number;
  previewIssues: readonly AnimationPreviewIssue[];
}

export type PresentationRequestResolution =
  | {
      ok: true;
      request: ResolvedPresentationRequest;
    }
  | {
      ok: false;
      result: PresentResult;
    };

export const resolvePresentationRequest = (
  document: ProjectDocument,
  request: ViewPresentationRequest
): PresentationRequestResolution => {
  const clip = request.clipId === null
    ? null
    : document.animations[request.clipId];
  if (request.clipId !== null && !clip) {
    return {
      ok: false,
      result: {
        ok: false,
        revision: document.revision,
        error: {
          code: 'not_found',
          path: 'clipId',
          expected: 'existing animation clip ID'
        }
      }
    };
  }
  const previewIssues = clip
    ? blockingAnimationPreviewIssues(
        clip,
        document.formatProfile.id
      )
    : [];
  if (previewIssues.length > 0) {
    return {
      ok: false,
      result: {
        ok: false,
        revision: document.revision,
        error: {
          code: 'preview_unfaithful',
          path: `animations.${clip?.id ?? ''}`,
          expected: 'animation features supported by the live renderer'
        }
      }
    };
  }
  return {
    ok: true,
    request: {
      clip,
      timeSeconds: clip
        ? Math.min(request.timeSeconds, clip.durationSeconds)
        : 0,
      previewIssues
    }
  };
};

export const createPresentationSession = (
  document: ProjectDocument,
  request: ViewPresentationRequest,
  resolved: ResolvedPresentationRequest,
  nonce: number
): PresentationSession => ({
  nonce,
  projectId: document.id,
  sourceRevision: document.revision,
  review: request.review,
  purpose: request.purpose,
  milestone: request.milestone,
  mode: request.mode,
  camera: request.camera,
  clipId: resolved.clip?.id ?? null,
  timeSeconds: resolved.timeSeconds,
  cycle:
    resolved.clip && request.mode === 'cycle'
      ? createCycleObservation(
          resolved.clip.durationSeconds,
          resolved.clip.fps
        )
      : null,
  phase: 'observing',
  previewIssues: resolved.previewIssues,
  reviewChecks: request.reviewChecks
});

export const presentationTimeoutMs = (
  request: ViewPresentationRequest,
  clip: AnimationClip | null
): number =>
  request.mode === 'cycle' && clip
    ? cyclePresentationTimeoutMs(clip.durationSeconds)
    : FRAME_PRESENTATION_TIMEOUT_MS;
