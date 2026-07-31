import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

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
  documents: readonly ProjectDocument[];
  receipts: readonly CommandReceipt[];
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
}

export const createBuildGif = async (
  assets: ProjectAssets,
  options: BuildGifExportOptions,
  context: GifCaptureContext
): Promise<GifCaptureFile> => {
  const document = options.documents.at(-1);
  if (!document) throw new Error('Build process is unavailable.');
  const captureOptions: BuildGifCaptureOptions = {
    ...options,
    assets,
    signal: context.signal,
    onProgress: context.onProgress
  };
  const capture = await renderBuildGif(captureOptions);
  return {
    ...capture,
    ...await createArtifactBinding(document, capture.bytes),
    kind: 'build',
    name: `${safeArtifactName(document.name)}-build-process.gif`,
    contentType: 'image/gif'
  };
};
