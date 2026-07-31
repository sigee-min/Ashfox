import type { ProjectDocument } from '@ashfox/engine-core';

import {
  createArtifactBinding,
  safeArtifactName,
  type ArtifactFile
} from '../files/artifactFile';
import type { CaptureDimensions } from './captureSurface';

export interface ResultPngCapture extends CaptureDimensions {
  bytes: Uint8Array;
}

export interface ResultCaptureFile
  extends ArtifactFile, CaptureDimensions {
  kind: 'result';
  contentType: 'image/png';
}

export const createResultCaptureFile = async (
  document: ProjectDocument,
  capture: ResultPngCapture
): Promise<ResultCaptureFile> => ({
  ...capture,
  ...await createArtifactBinding(document, capture.bytes),
  kind: 'result',
  name: `${safeArtifactName(document.name)}-result.png`,
  contentType: 'image/png'
});

export const isResultCaptureFile = (
  file: ArtifactFile | null
): file is ResultCaptureFile =>
  file !== null &&
  file.kind === 'result' &&
  file.contentType === 'image/png' &&
  'width' in file &&
  'height' in file;
