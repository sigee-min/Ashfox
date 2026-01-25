import type { ToolResponse } from '../types';
import type { UsecaseResult } from '../usecases/result';

export const toToolResponse = <T>(result: UsecaseResult<T>): ToolResponse<T> => {
  if (result.ok) return { ok: true, data: result.value };
  return { ok: false, error: result.error };
};
