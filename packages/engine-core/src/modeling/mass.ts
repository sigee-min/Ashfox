import {
  assertLatticePoint,
  assertPositiveLatticePoint,
  createOccupancyGrid
} from './lattice';
import { profileExponent, superellipsoidScore } from './profile';
import type {
  LatticePoint,
  OccupancyGrid,
  RasterMassPrimitive,
  SurfacePixelDensity
} from './types';

const INCLUSION_EPSILON = 1e-12;

export const rasterizeMass = (
  density: SurfacePixelDensity,
  spec: RasterMassPrimitive
): OccupancyGrid => {
  assertLatticePoint(spec.center, 'mass.center');
  assertPositiveLatticePoint(spec.radii, 'mass.radii');
  const exponent = profileExponent(spec.profile);
  const cells: LatticePoint[] = [];

  for (
    let x = spec.center.x - spec.radii.x;
    x < spec.center.x + spec.radii.x;
    x += 1
  ) {
    for (
      let y = spec.center.y - spec.radii.y;
      y < spec.center.y + spec.radii.y;
      y += 1
    ) {
      for (
        let z = spec.center.z - spec.radii.z;
        z < spec.center.z + spec.radii.z;
        z += 1
      ) {
        const score = superellipsoidScore(
          {
            x: x + 0.5 - spec.center.x,
            y: y + 0.5 - spec.center.y,
            z: z + 0.5 - spec.center.z
          },
          spec.radii,
          exponent
        );
        if (score <= 1 + INCLUSION_EPSILON) {
          cells.push({ x, y, z });
        }
      }
    }
  }

  return createOccupancyGrid(density, cells);
};
