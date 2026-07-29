import type { ProjectDocument } from '@ashfox/engine-core';

import type { ProjectAssets } from '../files/projectAssets';
import { applyAnimationPose } from '../workbench/viewport/animationPose';
import {
  applyCameraPreset,
  type CameraMode
} from '../workbench/viewport/cameraPresets';
import type { ViewportEnvironmentId } from '../workbench/viewport/viewportEnvironment';
import {
  throwIfCaptureAborted,
  yieldCaptureFrame
} from './captureAbort';
import {
  createGifCaptureSurface,
  disposeGifCaptureSurface,
  encodeGifSurfaceFrame,
  finishGifCaptureSurface,
  waitForSceneTextures,
  type GifCaptureResult
} from './gifCaptureSurface';
import {
  createGifFramePlan,
  GIF_CAPTURE_FPS
} from './gifFramePlan';
import { drawAnimationFrameOverlay } from './gifFrameOverlay';
import { createCaptureProjection } from './createCaptureProjection';

export interface AnimatedGifCaptureOptions {
  document: ProjectDocument;
  assets: ProjectAssets;
  clipId: string;
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export type AnimatedGifCapture = GifCaptureResult;

export const renderAnimatedGif = async (
  options: AnimatedGifCaptureOptions
): Promise<AnimatedGifCapture> => {
  const clip = options.document.animations[options.clipId];
  if (!clip) throw new Error('Choose an animation clip before capture.');
  const plan = createGifFramePlan(clip, GIF_CAPTURE_FPS);
  const surface = createGifCaptureSurface(
    options.environment,
    options.cameraMode
  );
  const projection = createCaptureProjection(
    options.document,
    options.assets
  );
  surface.scene.add(projection.root);
  applyCameraPreset(
    surface.camera,
    options.cameraMode,
    projection.root
  );

  try {
    await waitForSceneTextures(projection.root, options.signal);
    for (const frame of plan.frames) {
      throwIfCaptureAborted(options.signal);
      applyAnimationPose(
        options.document,
        projection,
        options.clipId,
        frame.timeSeconds
      );
      encodeGifSurfaceFrame(surface, (context) => {
        drawAnimationFrameOverlay(
          context,
          clip.name,
          frame.timeSeconds,
          frame.events
        );
      });
      options.onProgress?.(frame.index + 1, plan.frames.length);
      await yieldCaptureFrame();
    }
    throwIfCaptureAborted(options.signal);
    return {
      bytes: finishGifCaptureSurface(surface),
      frameCount: plan.frames.length,
      eventCount: plan.eventCount,
      fps: plan.fps
    };
  } finally {
    surface.scene.remove(projection.root);
    projection.dispose();
    disposeGifCaptureSurface(surface);
  }
};
