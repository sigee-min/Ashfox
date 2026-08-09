import {
  blockingCanonicalAnimationPreviewIssues,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createArtifactBinding,
  safeArtifactName
} from '../files/artifactFile';
import type { ProjectAssets } from '../../application/projectAssets';
import type { CameraMode } from '../../rendering/cameraPresets';
import type { ViewportEnvironmentId } from '../../rendering/viewportEnvironment';
import type { GifCaptureContext } from './gifCaptureContext';
import type { GifCaptureFile } from './gifCaptureFile';
import { renderAnimatedGif } from './renderAnimatedGif';

export interface AnimatedGifExportOptions {
  readonly clipId: string;
  readonly environment: ViewportEnvironmentId;
  readonly cameraMode: CameraMode;
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
  const previewIssues = blockingCanonicalAnimationPreviewIssues(clip);
  if (previewIssues.length > 0) {
    const issueCodes = [
      ...new Set(previewIssues.map((issue) => issue.code))
    ];
    throw new Error(
      `Animation GIF capture cannot faithfully render "${clip.name}": ` +
      `${issueCodes.join(', ')}. Bake the clip to supported numeric ` +
      'bone-space transform keys before capture.'
    );
  }
  const capture = await renderAnimatedGif({
    document,
    assets,
    ...options,
    signal: context.signal,
    onProgress: context.onProgress
  });
  return {
    ...capture,
    ...await createArtifactBinding(document, capture.bytes),
    kind: 'animation',
    name:
      `${safeArtifactName(document.name)}-` +
      `${animationFileName(clip.name)}.gif`,
    contentType: 'image/gif'
  };
};
