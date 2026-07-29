export interface GifCaptureContext {
  signal: AbortSignal;
  onProgress: (completed: number, total: number) => void;
}
