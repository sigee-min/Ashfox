import type { Limits } from '../types';
import type { DimensionAxis } from './dimensions';
import { checkDimensions } from './dimensions';
import { fail, ok, type DomainResult } from './result';

export type UvPaintSourceSize = { width: number; height: number };

export type UvPaintSourceOptions = {
  requireInteger?: boolean;
};

export const validateUvPaintSourceSize = (
  width: number,
  height: number,
  limits: Limits,
  label: string,
  options?: UvPaintSourceOptions
): DomainResult<UvPaintSourceSize> => {
  const sizeCheck = checkDimensions(width, height, {
    requireInteger: options?.requireInteger,
    maxSize: limits.maxTextureSize
  });
  if (!sizeCheck.ok) {
    const axisLabel = formatAxisLabel(sizeCheck.axis);
    if (sizeCheck.reason === 'non_positive') {
      return fail('invalid_payload', `uvPaint source ${axisLabel} must be > 0 (${label})`, {
        reason: 'non_positive',
        axis: sizeCheck.axis,
        width,
        height
      });
    }
    if (sizeCheck.reason === 'non_integer') {
      return fail('invalid_payload', `uvPaint source ${axisLabel} must be an integer (${label})`, {
        reason: 'non_integer',
        axis: sizeCheck.axis,
        width,
        height
      });
    }
    return fail(
      'invalid_payload',
      `uvPaint source size exceeds max ${limits.maxTextureSize} (${label})`,
      {
        reason: 'exceeds_max',
        axis: sizeCheck.axis,
        width,
        height,
        maxSize: limits.maxTextureSize
      }
    );
  }
  return ok({ width, height });
};

const formatAxisLabel = (axis?: DimensionAxis): string => {
  if (!axis) return 'width/height';
  return axis === 'height' ? 'height' : 'width';
};
