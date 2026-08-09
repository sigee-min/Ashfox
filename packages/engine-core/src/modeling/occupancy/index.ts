import type { SurfacePixelDensity } from '../contract';
import type { PartSpec } from '../part';
import {
  canonicalizeGeometry,
  canonicalPartOrder
} from './canonicalize';
import type { CanonicalizePartOccupanciesResult } from './contract';
import { validateCanonicalOccupancies } from './validate';

export { canonicalPartOrder } from './canonicalize';
export { PART_OCCUPANCY_POLICY } from './contract';
export type {
  CanonicalizePartOccupanciesResult
} from './contract';

export const canonicalizePartOccupancies = (
  parts: readonly PartSpec[],
  density: SurfacePixelDensity
): CanonicalizePartOccupanciesResult => {
  const ordered = canonicalPartOrder(parts);
  if (!ordered) {
    return {
      ok: false,
      path: 'parts',
      message:
        'Part hierarchy must contain unique IDs, existing parents, and no cycles.'
    };
  }
  const canonical = canonicalizeGeometry(ordered, density);
  if ('ok' in canonical) return canonical;
  return validateCanonicalOccupancies(ordered, canonical);
};
