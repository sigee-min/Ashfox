import type { GifCaptureResult } from './gifCaptureSurface';
import type { ArtifactFile } from '../files/artifactFile';

export interface GifCaptureFile extends GifCaptureResult, ArtifactFile {
  kind: 'build' | 'animation';
  name: string;
  contentType: 'image/gif';
}

export const isGifCaptureFile = (
  file: ArtifactFile | null
): file is GifCaptureFile =>
  file !== null &&
  (file.kind === 'build' || file.kind === 'animation') &&
  file.contentType === 'image/gif' &&
  'frameCount' in file;
