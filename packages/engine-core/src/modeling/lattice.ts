import { isSurfacePixelDensity } from '../model';
import type {
  Axis,
  CellKey,
  LatticeBounds,
  LatticePoint,
  OccupancyGrid,
  PlanePoint,
  SurfacePixelDensity
} from './types';

export const AXES: readonly Axis[] = ['x', 'y', 'z'];

export const assertDensity: (
  density: number
) => asserts density is SurfacePixelDensity = (density) => {
  if (!isSurfacePixelDensity(density)) {
    throw new RangeError('surface pixel density must be 1, 2, or 4');
  }
};

export const assertLatticeInteger = (
  value: number,
  field: string
): void => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${field} must be a safe lattice integer`);
  }
};

export const assertLatticePoint = (
  point: LatticePoint,
  field: string
): void => {
  assertLatticeInteger(point.x, `${field}.x`);
  assertLatticeInteger(point.y, `${field}.y`);
  assertLatticeInteger(point.z, `${field}.z`);
};

export const assertPlanePoint = (point: PlanePoint, field: string): void => {
  assertLatticeInteger(point.u, `${field}.u`);
  assertLatticeInteger(point.v, `${field}.v`);
};

export const assertPositiveLatticePoint = (
  point: LatticePoint,
  field: string
): void => {
  assertLatticePoint(point, field);
  if (point.x <= 0 || point.y <= 0 || point.z <= 0) {
    throw new RangeError(`${field} components must be greater than zero`);
  }
};

export const cellKey = (point: LatticePoint): CellKey => {
  assertLatticePoint(point, 'cell');
  return `${point.x},${point.y},${point.z}`;
};

export const parseCellKey = (key: CellKey): LatticePoint => {
  const coordinates = key.split(',').map(Number);
  if (coordinates.length !== 3) {
    throw new TypeError(`invalid lattice cell key: ${key}`);
  }
  const point = {
    x: coordinates[0],
    y: coordinates[1],
    z: coordinates[2]
  };
  assertLatticePoint(point, 'cell');
  return point;
};

export const comparePoints = (
  left: LatticePoint,
  right: LatticePoint
): number =>
  left.x - right.x || left.y - right.y || left.z - right.z;

export const sortCells = (
  cells: Iterable<CellKey>
): readonly LatticePoint[] =>
  [...cells].map(parseCellKey).sort(comparePoints);

export const createOccupancyGrid = (
  density: SurfacePixelDensity,
  cells: Iterable<LatticePoint>
): OccupancyGrid => {
  assertDensity(density);
  const keys = new Set<CellKey>();
  for (const cell of cells) {
    keys.add(cellKey(cell));
  }
  return { density, cells: keys };
};

export const latticeToWorld = (
  coordinate: number,
  density: SurfacePixelDensity
): number => {
  assertLatticeInteger(coordinate, 'coordinate');
  assertDensity(density);
  return coordinate / density;
};

export const worldToLattice = (
  coordinate: number,
  density: SurfacePixelDensity,
  epsilon = 1e-9
): number => {
  assertDensity(density);
  if (!Number.isFinite(coordinate)) {
    throw new RangeError('world coordinate must be finite');
  }
  const scaled = coordinate * density;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > epsilon) {
    throw new RangeError(
      `world coordinate ${coordinate} is not aligned to density ${density}`
    );
  }
  assertLatticeInteger(rounded, 'scaled coordinate');
  return rounded;
};

export const pointFromPlane = (
  normalAxis: Axis,
  normal: number,
  plane: PlanePoint
): LatticePoint => {
  if (normalAxis === 'x') {
    return { x: normal, y: plane.u, z: plane.v };
  }
  if (normalAxis === 'y') {
    return { x: plane.u, y: normal, z: plane.v };
  }
  return { x: plane.u, y: plane.v, z: normal };
};

export const stableBoundsKey = (
  density: SurfacePixelDensity,
  bounds: LatticeBounds
): string => {
  assertDensity(density);
  assertLatticePoint(bounds.min, 'bounds.min');
  assertLatticePoint(bounds.max, 'bounds.max');
  if (
    bounds.min.x >= bounds.max.x ||
    bounds.min.y >= bounds.max.y ||
    bounds.min.z >= bounds.max.z
  ) {
    throw new RangeError('bounds must have positive extent on every axis');
  }
  return [
    `d${density}`,
    `${bounds.min.x},${bounds.min.y},${bounds.min.z}`,
    `${bounds.max.x},${bounds.max.y},${bounds.max.z}`
  ].join(':');
};

export const boundsContainsCell = (
  bounds: LatticeBounds,
  cell: LatticePoint
): boolean =>
  cell.x >= bounds.min.x &&
  cell.x < bounds.max.x &&
  cell.y >= bounds.min.y &&
  cell.y < bounds.max.y &&
  cell.z >= bounds.min.z &&
  cell.z < bounds.max.z;
