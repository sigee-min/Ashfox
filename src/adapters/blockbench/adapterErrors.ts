import type { ToolError } from '../../types';
import type { Logger } from '../../logging';

export const withAdapterError = <T>(
  log: Logger,
  context: string,
  fallbackMessage: string,
  fn: () => T,
  onError?: (error: ToolError) => T
): T => {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : fallbackMessage;
    log.error(`${context} error`, { message });
    const error: ToolError = { code: 'unknown', message };
    return onError ? onError(error) : (error as unknown as T);
  }
};
