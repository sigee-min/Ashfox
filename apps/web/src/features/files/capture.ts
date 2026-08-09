import type { GifCaptureRequest } from '../capture/gifCaptureRequest';

/** Closed capture request accepted by the file-delivery owner. */
export type CaptureArtifactRequest =
  | { kind: 'result' }
  | GifCaptureRequest;
