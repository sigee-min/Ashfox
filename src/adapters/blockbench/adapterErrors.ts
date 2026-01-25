import type { ToolError } from '../../types';
import { errorMessage, type Logger } from '../../logging';

export const withToolErrorAdapterError = (
  log: Logger,
  context: string,
  fallbackMessage: string,
  fn: () => ToolError | null
): ToolError | null => {
  try {
    return fn();
  } catch (err) {
    const message = errorMessage(err, fallbackMessage);
    log.error(`${context} error`, { message });
    return { code: 'unknown', message };
  }
};

export const withAdapterError = <T>(
  log: Logger,
  context: string,
  fallbackMessage: string,
  fn: () => T,
  onError: (error: ToolError) => T
): T => {
  try {
    return fn();
  } catch (err) {
    const message = errorMessage(err, fallbackMessage);
    log.error(`${context} error`, { message });
    return onError({ code: 'unknown', message });
  }
};
