import type { CommandReceipt, ProjectDocument } from '@ashfox/engine-core';

import type { CameraMode } from '../../rendering/cameraPresets';
import type { ViewportEnvironmentId } from '../../rendering/viewportEnvironment';
import type { ArtifactFile } from '../files/artifactFile';
import type { FileOperationState } from '../files/fileOperationState';
import { createBuildCapturePlan } from './buildCaptureTimeline';
import type { GifCaptureFile } from './gifCaptureFile';
import type { GifCaptureRequest } from './gifCaptureRequest';
import {
  createGifFramePlan,
  GIF_CAPTURE_FPS
} from './gifFramePlan';

export type CaptureMenuMode = 'build' | 'animation';

export interface CaptureMenuAuthority {
  readonly document: ProjectDocument;
  readonly buildDocuments: readonly ProjectDocument[];
  readonly activity: readonly CommandReceipt[];
  readonly activeClipId: string | null;
  readonly environment: ViewportEnvironmentId;
  readonly cameraMode: CameraMode;
  readonly operation: Readonly<FileOperationState<ArtifactFile>>;
  readonly captureFile: GifCaptureFile | null;
  readonly canDownload: boolean;
}

export interface CapturePlanSummary {
  readonly frames: number;
  readonly events: number;
  readonly error: string | null;
}

export interface CapturePlanSnapshot {
  readonly build: CapturePlanSummary;
  readonly animation: CapturePlanSummary;
}

export interface CapturePlanReader {
  readonly read: (authority: CaptureMenuAuthority) => CapturePlanSnapshot;
}

export interface CaptureMenuViewModel {
  readonly mode: CaptureMenuMode;
  readonly headingMeta: string;
  readonly capturing: boolean;
  readonly ready: boolean;
  readonly showAnimationPicker: boolean;
  readonly clips: readonly Readonly<{ id: string; name: string }>[];
  readonly activeClipId: string;
  readonly framesLabel: string;
  readonly eventsLabel: string;
  readonly cameraLabel: string;
  readonly statusMessage: string;
  readonly statusTone: 'default' | 'error';
  readonly startLabel: string;
  readonly startDisabled: boolean;
  readonly downloadDisabled: boolean;
}

export interface CaptureRequestPort {
  readonly create: (
    authority: CaptureMenuAuthority,
    mode: CaptureMenuMode
  ) => GifCaptureRequest | null;
}

const failedPlan = (
  error: unknown,
  fallback: string
): CapturePlanSummary => Object.freeze({
  frames: 0,
  events: 0,
  error: error instanceof Error ? error.message : fallback
});

const readBuildPlan = (
  authority: CaptureMenuAuthority
): CapturePlanSummary => {
  try {
    const plan = createBuildCapturePlan(
      authority.buildDocuments,
      authority.activity
    );
    return Object.freeze({
      frames: plan.frames.length,
      events: plan.events.length,
      error: null
    });
  } catch (error: unknown) {
    return failedPlan(error, 'Build process capture is unavailable.');
  }
};

const readAnimationPlan = (
  authority: CaptureMenuAuthority
): CapturePlanSummary => {
  const clip = authority.activeClipId
    ? authority.document.animations[authority.activeClipId]
    : undefined;
  if (!clip) {
    return Object.freeze({
      frames: 0,
      events: 0,
      error: 'Add or select an animation clip first.'
    });
  }
  try {
    const plan = createGifFramePlan(clip);
    return Object.freeze({
      frames: plan.frames.length,
      events: plan.eventCount,
      error: null
    });
  } catch (error: unknown) {
    return failedPlan(error, 'Animation capture is unavailable.');
  }
};

export const capturePlanReader: CapturePlanReader = Object.freeze({
  read: (authority: CaptureMenuAuthority) => Object.freeze({
    build: readBuildPlan(authority),
    animation: readAnimationPlan(authority)
  })
});

const readyMessage = (file: GifCaptureFile | null): string | null => {
  if (!file) return null;
  const eventText = file.eventCount > 0
    ? ` · ${file.eventCount} ${
        file.kind === 'build' ? 'build events' : 'events'
      }`
    : '';
  return `Ready · ${file.frameCount} frames${eventText}`;
};

export const presentCaptureMenu = (
  authority: CaptureMenuAuthority,
  mode: CaptureMenuMode,
  reader: CapturePlanReader = capturePlanReader
): CaptureMenuViewModel => {
  const plans = reader.read(authority);
  const plan = plans[mode];
  const readyFile = authority.captureFile?.kind === mode
    ? authority.captureFile
    : null;
  const capturing =
    authority.operation.phase === 'running' &&
    authority.operation.kind === 'capture';
  const captureMessage =
    authority.operation.kind === 'capture' &&
    authority.operation.phase !== 'succeeded'
      ? authority.operation.message
      : null;
  const captureFailed =
    authority.operation.kind === 'capture' &&
    authority.operation.phase === 'failed';
  const fallbackMessage = mode === 'build'
    ? 'Committed revisions are grouped into semantic build events.'
    : 'Sound, particle, and timeline events appear on their sampled frame.';
  const clips = Object.values(authority.document.animations).map((clip) =>
    Object.freeze({ id: clip.id, name: clip.name })
  );

  return Object.freeze({
    mode,
    headingMeta: `${GIF_CAPTURE_FPS} fps · 640 × 360 · browser local`,
    capturing,
    ready: readyFile !== null,
    showAnimationPicker: mode === 'animation',
    clips: Object.freeze(clips),
    activeClipId: authority.activeClipId ?? '',
    framesLabel: `${plan.frames} frames`,
    eventsLabel:
      `${plan.events} ${mode === 'build' ? 'build events' : 'timed events'}`,
    cameraLabel: `${authority.cameraMode} camera`,
    statusMessage: capturing
      ? authority.operation.message
      : plan.error ?? captureMessage ?? readyMessage(readyFile) ?? fallbackMessage,
    statusTone: plan.error || captureFailed ? 'error' : 'default',
    startLabel: readyFile
      ? 'Capture again'
      : `Capture ${mode === 'build' ? 'build process' : 'animation'}`,
    startDisabled:
      plan.error !== null ||
      (mode === 'animation' && authority.activeClipId === null),
    downloadDisabled: !authority.canDownload
  });
};

export const captureRequestPort: CaptureRequestPort = Object.freeze({
  create: (
    authority: CaptureMenuAuthority,
    mode: CaptureMenuMode
  ): GifCaptureRequest | null => {
    if (mode === 'build') {
      return Object.freeze({
        kind: 'build',
        documents: authority.buildDocuments,
        receipts: authority.activity,
        environment: authority.environment,
        cameraMode: authority.cameraMode
      });
    }
    if (!authority.activeClipId) return null;
    return Object.freeze({
      kind: 'animation',
      clipId: authority.activeClipId,
      environment: authority.environment,
      cameraMode: authority.cameraMode
    });
  }
});
