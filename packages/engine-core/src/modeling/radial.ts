import {
  assertLatticeInteger,
  assertPlanePoint,
  createOccupancyGrid,
  pointFromPlane
} from './lattice';
import type {
  LatticePoint,
  OccupancyGrid,
  RasterRadialPrimitive,
  SurfacePixelDensity
} from './types';

const INCLUSION_EPSILON = 1e-12;

export const rasterizeRadial = (
  density: SurfacePixelDensity,
  spec: RasterRadialPrimitive
): OccupancyGrid => {
  assertLatticeInteger(spec.normalStart, 'radial.normalStart');
  assertLatticeInteger(spec.depth, 'radial.depth');
  assertPlanePoint(spec.center, 'radial.center');
  assertLatticeInteger(spec.outerRadius, 'radial.outerRadius');
  const innerRadius = spec.innerRadius ?? 0;
  assertLatticeInteger(innerRadius, 'radial.innerRadius');
  if (spec.depth <= 0) {
    throw new RangeError('radial.depth must be greater than zero');
  }
  if (spec.outerRadius <= 0) {
    throw new RangeError('radial.outerRadius must be greater than zero');
  }
  if (innerRadius < 0 || innerRadius >= spec.outerRadius) {
    throw new RangeError(
      'radial.innerRadius must be non-negative and less than outerRadius'
    );
  }
  assertLatticeInteger(spec.normalStart + spec.depth, 'radial.normalEnd');

  const cells: LatticePoint[] = [];
  const innerSquared = innerRadius * innerRadius;
  const outerSquared = spec.outerRadius * spec.outerRadius;

  for (
    let normal = spec.normalStart;
    normal < spec.normalStart + spec.depth;
    normal += 1
  ) {
    for (
      let u = spec.center.u - spec.outerRadius;
      u < spec.center.u + spec.outerRadius;
      u += 1
    ) {
      for (
        let v = spec.center.v - spec.outerRadius;
        v < spec.center.v + spec.outerRadius;
        v += 1
      ) {
        const deltaU = u + 0.5 - spec.center.u;
        const deltaV = v + 0.5 - spec.center.v;
        const squaredDistance = deltaU * deltaU + deltaV * deltaV;
        if (
          squaredDistance + INCLUSION_EPSILON >= innerSquared &&
          squaredDistance <= outerSquared + INCLUSION_EPSILON
        ) {
          cells.push(pointFromPlane(spec.normalAxis, normal, { u, v }));
        }
      }
    }
  }

  return createOccupancyGrid(density, cells);
};
