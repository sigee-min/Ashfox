import type { ToolError, ToolErrorCode, ToolResponse } from '../types';
import { UsecaseResult } from '../usecases/result';
import { applyToolErrorPolicy } from '../services/toolError';

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

export const toToolResponse = <T>(result: UsecaseResult<T>): ToolResponse<T> => {
  if (result.ok) return { ok: true, data: result.value };
  return { ok: false, error: result.error };
};
