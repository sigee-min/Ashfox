import { rasterizeMass } from './mass';
import { rasterizePlate } from './plate';
import { rasterizeRadial } from './radial';
import { rasterizeSegment } from './segment';
import type {
  OccupancyGrid,
  RasterPrimitive,
  SurfacePixelDensity
} from './types';

export const rasterizePrimitive = (
  density: SurfacePixelDensity,
  spec: RasterPrimitive
): OccupancyGrid => {
  switch (spec.kind) {
    case 'mass':
      return rasterizeMass(density, spec);
    case 'segment':
      return rasterizeSegment(density, spec);
    case 'plate':
      return rasterizePlate(density, spec);
    case 'radial':
      return rasterizeRadial(density, spec);
  }
};
