import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import type { ProjectAssets } from '../../application/projectAssets';
import { applyAnimationPose } from '../../rendering/animationPose';
import {
  applyCameraPreset,
  type CameraMode
} from '../../rendering/cameraPresets';
import type { ProjectSceneProjection } from '../../rendering/sceneTypes';
import type { ViewportEnvironmentId } from '../../rendering/viewportEnvironment';
import {
  createBuildCapturePlan
} from './buildCaptureTimeline';
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
import { waitForProjectionTextures } from './captureSurface';
import { drawBuildFrameOverlay } from './gifFrameOverlay';
import { resolveBuildReviewClip } from './buildReviewClip';
import { createCaptureProjection } from './createCaptureProjection';

export interface BuildGifCaptureOptions {
  documents: readonly ProjectDocument[];
  receipts: readonly CommandReceipt[];
  assets: ProjectAssets;
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

const applyReviewPose = (
  projection: ProjectSceneProjection,
  document: ProjectDocument,
  category: 'animation' | 'complete',
  eventFrameIndex: number,
  holdFrames: number
): void => {
  const clip = resolveBuildReviewClip(document);
  if (!clip) return;
  const denominator = Math.max(1, holdFrames - 1);
  const cycle =
    category === 'complete'
      ? eventFrameIndex / denominator
      : Math.min(1, eventFrameIndex / denominator);
  applyAnimationPose(
    document,
    projection,
    clip.id,
    cycle * clip.durationSeconds
  );
};

const applyProgressiveReveal = (
  projection: ProjectSceneProjection,
  document: ProjectDocument,
  createdEntityIds: readonly string[],
  eventFrameIndex: number,
  holdFrames: number
): void => {
  const renderableIds = createdEntityIds.filter((id) => {
    const node = document.scene.nodes[id];
    return node?.visible === true &&
      (node.kind === 'cube' || node.kind === 'mesh');
  });
  if (renderableIds.length === 0) return;
  const denominator = Math.max(1, holdFrames - 1);
  const visibleCount = Math.floor(
    renderableIds.length * eventFrameIndex / denominator
  );
  for (let index = 0; index < renderableIds.length; index += 1) {
    const id = renderableIds[index];
    const object = id ? projection.objectsByNodeId.get(id) : undefined;
    if (object) object.visible = index < visibleCount;
  }
};

export const renderBuildGif = async (
  options: BuildGifCaptureOptions
): Promise<GifCaptureResult> => {
  const plan = createBuildCapturePlan(
    options.documents,
    options.receipts
  );
  const surface = createGifCaptureSurface(
    options.environment,
    options.cameraMode
  );
  const finalDocument = plan.events.at(-1)?.document;
  if (!finalDocument) throw new Error('Build process has no final frame.');
  const framingProjection = createCaptureProjection(
    finalDocument,
    options.assets,
    { showTextures: false }
  );
  applyCameraPreset(
    surface.camera,
    options.cameraMode,
    framingProjection.root
  );
  framingProjection.dispose();
  let activeProjection: ProjectSceneProjection | null = null;
  let activeEventIndex = -1;

  try {
    for (const frame of plan.frames) {
      throwIfCaptureAborted(options.signal);
      if (frame.eventIndex !== activeEventIndex) {
        if (activeProjection) {
          surface.scene.remove(activeProjection.root);
          activeProjection.dispose();
        }
        activeProjection = createCaptureProjection(
          frame.event.document,
          options.assets,
          {
            showTextures:
              frame.event.category === 'texture' ||
              frame.event.category === 'animation' ||
              frame.event.category === 'complete'
          }
        );
        surface.scene.add(activeProjection.root);
        await waitForProjectionTextures(
          activeProjection,
          options.signal
        );
        activeEventIndex = frame.eventIndex;
      }

      if (
        activeProjection &&
        (frame.event.category === 'animation' ||
          frame.event.category === 'complete')
      ) {
        applyReviewPose(
          activeProjection,
          frame.event.document,
          frame.event.category,
          frame.eventFrameIndex,
          frame.event.holdFrames
        );
      }
      if (activeProjection && frame.event.category === 'geometry') {
        applyProgressiveReveal(
          activeProjection,
          frame.event.document,
          frame.event.createdEntityIds,
          frame.eventFrameIndex,
          frame.event.holdFrames
        );
      }
      encodeGifSurfaceFrame(surface, (context) => {
        drawBuildFrameOverlay(
          context,
          frame.event.label,
          frame.eventIndex,
          plan.events.length,
          frame.progress
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
      eventCount: plan.events.length,
      fps: plan.fps
    };
  } finally {
    if (activeProjection) {
      surface.scene.remove(activeProjection.root);
      activeProjection.dispose();
    }
    disposeGifCaptureSurface(surface);
  }
};
