import * as THREE from 'three';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import type { ProjectAssets } from '../files/projectAssets';
import { applyAnimationPose } from '../workbench/viewport/animationPose';
import {
  applyCameraPreset,
  type CameraMode
} from '../workbench/viewport/cameraPresets';
import type { ProjectSceneProjection } from '../workbench/viewport/sceneTypes';
import type { ViewportEnvironmentId } from '../workbench/viewport/viewportEnvironment';
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
  waitForSceneTextures,
  type GifCaptureResult
} from './gifCaptureSurface';
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

const animateBuildCamera = (
  camera: THREE.PerspectiveCamera,
  cameraMode: CameraMode,
  object: THREE.Object3D | undefined,
  progress: number
): void => {
  const target = applyCameraPreset(camera, cameraMode, object);
  if (cameraMode !== 'perspective') return;
  const offset = camera.position.clone().sub(target);
  offset.applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.lerp(-0.08, 0.08, progress)
  );
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
};

const applyReviewPose = (
  projection: ProjectSceneProjection,
  document: ProjectDocument,
  category: 'animation' | 'complete',
  eventFrameIndex: number,
  holdFrames: number
): void => {
  const clip = Object.values(document.animations)[0];
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
        await waitForSceneTextures(
          activeProjection.root,
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
      animateBuildCamera(
        surface.camera,
        options.cameraMode,
        activeProjection?.root,
        frame.progress
      );
      encodeGifSurfaceFrame(surface);
      options.onProgress?.(frame.index + 1, plan.frames.length);
      await yieldCaptureFrame();
    }
    throwIfCaptureAborted(options.signal);
    return {
      bytes: finishGifCaptureSurface(surface),
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
