import type { AssetProject } from '@ashfox/engine-core';

import {
  createArtifactBinding,
  safeArtifactName
} from '../files/artifactFile';
import type { ProjectAssets } from '../../application/projectAssets';
import type { CameraMode } from '../../rendering/cameraPresets';
import type { ViewportEnvironmentId } from '../../rendering/viewportEnvironment';
import {
  renderBuildGif,
  type BuildGifCaptureOptions
} from './renderBuildGif';
import type { GifCaptureContext } from './gifCaptureContext';
import type { GifCaptureFile } from './gifCaptureFile';

export interface BuildGifExportOptions {
  readonly environment: ViewportEnvironmentId;
  readonly cameraMode: CameraMode;
}

export const createBuildGif = async (
  project: AssetProject,
  assets: ProjectAssets,
  options: BuildGifExportOptions,
  context: GifCaptureContext
): Promise<GifCaptureFile> => {
  const document = project.document;
  const captureOptions: BuildGifCaptureOptions = {
    ...options,
    document,
    assets,
    signal: context.signal,
    onProgress: context.onProgress
  };
  const capture = await renderBuildGif(captureOptions);
  return {
    ...capture,
    ...await createArtifactBinding(project, capture.bytes, 'capture'),
    kind: 'build',
    name: `${safeArtifactName(document.name)}-build-replay.gif`,
    contentType: 'image/gif'
  };
};
