import { isSurfacePixelDensity } from '../model';
import type {
  CellKey,
  LatticeBounds,
  LatticePoint,
  OccupancyGrid,
  SurfacePixelDensity
} from './contract';

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
