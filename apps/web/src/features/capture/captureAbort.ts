export const captureAbortError = (): DOMException =>
  new DOMException('Capture cancelled.', 'AbortError');

export const throwIfCaptureAborted = (
  signal: AbortSignal
): void => {
  if (signal.aborted) throw captureAbortError();
};

export const yieldCaptureFrame = (): Promise<void> =>
  new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
