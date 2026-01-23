import type { DomainResult } from './result';
import { fail } from './result';

export type UvBoundsErrorReason = 'negative' | 'out_of_bounds' | 'order';

export const validateUvBounds = (
  uv: [number, number, number, number],
  resolution: { width: number; height: number },
  details?: Record<string, unknown>
): DomainResult<never> | null => {
  const [x1, y1, x2, y2] = uv;
  if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0) {
    return fail('invalid_payload', 'Face UV coordinates must be non-negative.', {
      reason: 'negative',
      ...details
    });
  }
  if (x1 > resolution.width || x2 > resolution.width || y1 > resolution.height || y2 > resolution.height) {
    return fail(
      'invalid_payload',
      `Face UV is outside texture resolution ${resolution.width}x${resolution.height}.`,
      { reason: 'out_of_bounds', ...details }
    );
  }
  if (x2 < x1 || y2 < y1) {
    return fail('invalid_payload', 'Face UV coordinates must satisfy x2 >= x1 and y2 >= y1.', {
      reason: 'order',
      ...details
    });
  }
  return null;
};
