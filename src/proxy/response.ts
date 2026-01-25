import type { ToolError, ToolErrorCode, ToolResponse } from '../types';
import { applyToolErrorPolicy } from '../services/toolError';
import { toToolResponse } from '../services/toolResponse';

export type ErrorCode = ToolErrorCode;

export const err = <T = never>(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ToolResponse<T> => ({
  ok: false,
  error: applyToolErrorPolicy({ code, message, ...(details ? { details } : {}) })
});

export const errFromDomain = <T = never>(error: ToolError): ToolResponse<T> => ({
  ok: false,
  error: applyToolErrorPolicy(error)
});

export const errWithCode = <T = never>(
  code: ToolErrorCode,
  message: string,
  details?: Record<string, unknown>
): ToolResponse<T> => err(code, message, details);

export { toToolResponse };
