import type { ProjectDocument } from '@ashfox/engine-core';

import type { ProjectAssets } from '../../application/projectAssets';
import { applyCameraPreset } from '../../rendering/cameraPresets';
import { throwIfCaptureAborted } from './captureAbort';
import {
  captureSurfacePngBytes,
  createCaptureSurface,
  disposeCaptureSurface,
  waitForProjectionTextures
} from './captureSurface';
import { createCaptureProjection } from './createCaptureProjection';
import {
  createResultCaptureFile,
  type ResultCaptureFile,
  type ResultPngCapture
} from './resultCaptureFile';

export const RESULT_CAPTURE_WIDTH = 1280;
export const RESULT_CAPTURE_HEIGHT = 720;

export interface ResultCaptureContext {
  signal: AbortSignal;
}

export const renderResultPng = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  context: ResultCaptureContext
): Promise<ResultPngCapture> => {
  const surface = createCaptureSurface({
    width: RESULT_CAPTURE_WIDTH,
    height: RESULT_CAPTURE_HEIGHT,
    environment: 'studio',
    cameraMode: 'perspective'
  });
  const projection = createCaptureProjection(document, assets);
  surface.scene.add(projection.root);
  applyCameraPreset(surface.camera, 'perspective', projection.root);

  try {
    await waitForProjectionTextures(projection, context.signal);
    throwIfCaptureAborted(context.signal);
    const bytes = await captureSurfacePngBytes(surface);
    throwIfCaptureAborted(context.signal);
    return {
      bytes,
      width: surface.width,
      height: surface.height
    };
  } finally {
    surface.scene.remove(projection.root);
    projection.dispose();
    disposeCaptureSurface(surface);
  }
};

export const createResultPng = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  context: ResultCaptureContext
): Promise<ResultCaptureFile> =>
  createResultCaptureFile(
    document,
    await renderResultPng(document, assets, context)
  );
