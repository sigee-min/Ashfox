import type { SurfacePixelDensity } from '../model';

export type { SurfacePixelDensity } from '../model';

export type Axis = 'x' | 'y' | 'z';


export type LatticePoint = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type CellKey = `${number},${number},${number}`;

export type LatticeBounds = Readonly<{
  min: LatticePoint;
  max: LatticePoint;
}>;

export type OccupancyGrid = Readonly<{
  density: SurfacePixelDensity;
  cells: ReadonlySet<CellKey>;
}>;

export type Cuboid = Readonly<{
  bounds: LatticeBounds;
}>;
