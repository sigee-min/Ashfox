import { ToolError } from '../types';

export type UsecaseResult<T> = { ok: true; value: T } | { ok: false; error: ToolError };

export const ok = <T>(value: T): UsecaseResult<T> => ({ ok: true, value });
export const fail = (error: ToolError): UsecaseResult<never> => ({ ok: false, error });
