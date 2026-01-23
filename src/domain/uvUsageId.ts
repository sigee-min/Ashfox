import type { DomainResult } from './result';
import { fail, ok } from './result';

export const requireUvUsageId = (value: unknown, message?: string): DomainResult<string> => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('invalid_payload', message ?? 'uvUsageId is required. Call preflight_texture before continuing.');
  }
  return ok(value.trim());
};
