import type { GifCaptureRequest } from '../capture/gifCaptureRequest';

export type CaptureArtifactRequest =
  | { kind: 'result' }
  | GifCaptureRequest;
