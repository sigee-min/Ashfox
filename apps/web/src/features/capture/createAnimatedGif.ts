import type { ProjectDocument } from '@ashfox/engine-core';

import { safeArtifactName } from '../files/artifactFile';
import type { ProjectAssets } from '../files/projectAssets';
import type { CameraMode } from '../workbench/viewport/cameraPresets';
import type { ViewportEnvironmentId } from '../workbench/viewport/viewportEnvironment';
import type { GifCaptureContext } from './gifCaptureContext';
import type { GifCaptureFile } from './gifCaptureFile';
import { renderAnimatedGif } from './renderAnimatedGif';

export interface AnimatedGifExportOptions {
  clipId: string;
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
}

const animationFileName = (name: string): string => {
  const segments = name.split('.');
  return safeArtifactName(segments.at(-1) ?? name);
};

export const createAnimatedGif = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  options: AnimatedGifExportOptions,
  context: GifCaptureContext
): Promise<GifCaptureFile> => {
  const clip = document.animations[options.clipId];
  if (!clip) throw new Error('Choose an animation clip before capture.');
  const capture = await renderAnimatedGif({
    document,
    assets,
    ...options,
    signal: context.signal,
    onProgress: context.onProgress
  });
  return {
    ...capture,
    kind: 'animation',
    name:
      `${safeArtifactName(document.name)}-` +
      `${animationFileName(clip.name)}.gif`,
    contentType: 'image/gif'
  };
};
