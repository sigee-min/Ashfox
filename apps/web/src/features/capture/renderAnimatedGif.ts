import type { ProjectDocument } from '@ashfox/engine-core';

import type { ProjectAssets } from '../../application/projectAssets';
import { applyAnimationPose } from '../../rendering/animationPose';
import {
  type CameraMode
} from '../../rendering/cameraPresets';
import type { ViewportEnvironmentId } from '../../rendering/viewportEnvironment';
import {
  throwIfCaptureAborted,
  yieldCaptureFrame
} from './captureAbort';
import {
  createGifCaptureSurface,
  disposeGifCaptureSurface,
  encodeGifSurfaceFrame,
  finishGifCaptureSurface,
  type GifCaptureResult
} from './gifCaptureSurface';
import {
  frameCaptureObject,
  waitForProjectionTextures
} from './captureSurface';
import {
  createGifFramePlan,
  GIF_CAPTURE_FPS
} from './gifFramePlan';
import { drawAnimationFrameOverlay } from './gifFrameOverlay';
import { createCaptureProjection } from './projection';

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
  frameCaptureObject(
    surface,
    options.cameraMode,
    projection.root
  );

  try {
    await waitForProjectionTextures(projection, options.signal);
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
      width: surface.width,
      height: surface.height,
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
