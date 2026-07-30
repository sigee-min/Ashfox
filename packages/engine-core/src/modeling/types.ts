import type { SurfacePixelDensity } from '../model';

export type { SurfacePixelDensity } from '../model';

export type Axis = 'x' | 'y' | 'z';

export type AxisOrder = readonly [Axis, Axis, Axis];

export type LatticePoint = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type PlanePoint = Readonly<{
  u: number;
  v: number;
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

export type MassProfile = 'soft' | 'balanced' | 'hard';

export type RasterMassPrimitive = Readonly<{
  kind: 'mass';
  center: LatticePoint;
  radii: LatticePoint;
  profile: MassProfile;
}>;

export type RasterSegmentControlPoint = Readonly<{
  position: LatticePoint;
  radii: LatticePoint;
}>;

export type RasterSegmentPrimitive = Readonly<{
  kind: 'segment';
  points: readonly RasterSegmentControlPoint[];
  profile: MassProfile;
}>;

export type RasterRectangleShape = Readonly<{
  kind: 'rectangle';
  min: PlanePoint;
  max: PlanePoint;
}>;

export type RasterTrapezoidShape = Readonly<{
  kind: 'trapezoid';
  vertices: readonly [PlanePoint, PlanePoint, PlanePoint, PlanePoint];
}>;

export type RasterTriangleShape = Readonly<{
  kind: 'triangle';
  vertices: readonly [PlanePoint, PlanePoint, PlanePoint];
}>;

export type RasterPlateShape =
  | RasterRectangleShape
  | RasterTrapezoidShape
  | RasterTriangleShape;

export type RasterPlatePrimitive = Readonly<{
  kind: 'plate';
  normalAxis: Axis;
  normalStart: number;
  thickness: number;
  shape: RasterPlateShape;
}>;

export type RasterRadialPrimitive = Readonly<{
  kind: 'radial';
  normalAxis: Axis;
  normalStart: number;
  depth: number;
  center: PlanePoint;
  outerRadius: number;
  innerRadius?: number;
}>;

export type RasterPrimitive =
  | RasterMassPrimitive
  | RasterSegmentPrimitive
  | RasterPlatePrimitive
  | RasterRadialPrimitive;

export type Cuboid = Readonly<{
  bounds: LatticeBounds;
}>;

export type DecompositionScore = Readonly<{
  boxCount: number;
  internalSeamArea: number;
  aspectPenalty: number;
  lexicalSignature: string;
}>;

export type CuboidDecomposition = Readonly<{
  density: SurfacePixelDensity;
  axisOrder: AxisOrder;
  cuboids: readonly Cuboid[];
  score: DecompositionScore;
}>;
