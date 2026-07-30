import {
  assertDensity,
  assertLatticePoint,
  cellKey,
  comparePoints,
  parseCellKey,
  stableBoundsKey
} from './lattice';
import type {
  Axis,
  AxisOrder,
  CellKey,
  Cuboid,
  CuboidDecomposition,
  DecompositionScore,
  LatticeBounds,
  LatticePoint,
  OccupancyGrid
} from './types';

export const GREEDY_AXIS_ORDERS: readonly AxisOrder[] = [
  ['x', 'y', 'z'],
  ['x', 'z', 'y'],
  ['y', 'x', 'z'],
  ['y', 'z', 'x'],
  ['z', 'x', 'y'],
  ['z', 'y', 'x']
];

const compareAlongOrder = (
  left: LatticePoint,
  right: LatticePoint,
  order: AxisOrder
): number => {
  for (const axis of order) {
    const difference = left[axis] - right[axis];
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

const assertAxisOrder = (order: AxisOrder): void => {
  if (new Set(order).size !== 3 || order.some((axis) => !['x', 'y', 'z'].includes(axis))) {
    throw new TypeError('axis order must contain x, y, and z exactly once');
  }
};

const boundsForCell = (cell: LatticePoint): LatticeBounds => ({
  min: { ...cell },
  max: { x: cell.x + 1, y: cell.y + 1, z: cell.z + 1 }
});

const slabRange = (
  bounds: LatticeBounds,
  axis: Axis,
  coordinateAxis: Axis
): readonly [number, number] =>
  axis === coordinateAxis
    ? [bounds.max[coordinateAxis], bounds.max[coordinateAxis] + 1]
    : [bounds.min[coordinateAxis], bounds.max[coordinateAxis]];

const canExpandPositive = (
  bounds: LatticeBounds,
  axis: Axis,
  remaining: ReadonlySet<CellKey>
): boolean => {
  const [minX, maxX] = slabRange(bounds, axis, 'x');
  const [minY, maxY] = slabRange(bounds, axis, 'y');
  const [minZ, maxZ] = slabRange(bounds, axis, 'z');
  for (let x = minX; x < maxX; x += 1) {
    for (let y = minY; y < maxY; y += 1) {
      for (let z = minZ; z < maxZ; z += 1) {
        if (!remaining.has(cellKey({ x, y, z }))) {
          return false;
        }
      }
    }
  }
  return true;
};

const expandPositive = (
  bounds: LatticeBounds,
  axis: Axis
): LatticeBounds => ({
  min: bounds.min,
  max: {
    x: bounds.max.x + (axis === 'x' ? 1 : 0),
    y: bounds.max.y + (axis === 'y' ? 1 : 0),
    z: bounds.max.z + (axis === 'z' ? 1 : 0)
  }
});

const removeCuboidCells = (
  remaining: Set<CellKey>,
  bounds: LatticeBounds
): void => {
  for (let x = bounds.min.x; x < bounds.max.x; x += 1) {
    for (let y = bounds.min.y; y < bounds.max.y; y += 1) {
      for (let z = bounds.min.z; z < bounds.max.z; z += 1) {
        remaining.delete(cellKey({ x, y, z }));
      }
    }
  }
};

const compareCuboids = (left: Cuboid, right: Cuboid): number =>
  comparePoints(left.bounds.min, right.bounds.min) ||
  comparePoints(left.bounds.max, right.bounds.max);

const cuboidAspectPenalty = (cuboid: Cuboid): number => {
  const x = cuboid.bounds.max.x - cuboid.bounds.min.x;
  const y = cuboid.bounds.max.y - cuboid.bounds.min.y;
  const z = cuboid.bounds.max.z - cuboid.bounds.min.z;
  return (
    (x - y) * (x - y) +
    (y - z) * (y - z) +
    (z - x) * (z - x)
  );
};

const ownerByCell = (cuboids: readonly Cuboid[]): ReadonlyMap<CellKey, number> => {
  const owners = new Map<CellKey, number>();
  cuboids.forEach((cuboid, index) => {
    for (let x = cuboid.bounds.min.x; x < cuboid.bounds.max.x; x += 1) {
      for (let y = cuboid.bounds.min.y; y < cuboid.bounds.max.y; y += 1) {
        for (let z = cuboid.bounds.min.z; z < cuboid.bounds.max.z; z += 1) {
          owners.set(cellKey({ x, y, z }), index);
        }
      }
    }
  });
  return owners;
};

const internalSeamArea = (cuboids: readonly Cuboid[]): number => {
  const owners = ownerByCell(cuboids);
  const positiveNeighbors: readonly LatticePoint[] = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 }
  ];
  let area = 0;

  for (const [key, owner] of owners) {
    const cell = parseCellKey(key);
    for (const offset of positiveNeighbors) {
      const neighborOwner = owners.get(
        cellKey({
          x: cell.x + offset.x,
          y: cell.y + offset.y,
          z: cell.z + offset.z
        })
      );
      if (neighborOwner !== undefined && neighborOwner !== owner) {
        area += 1;
      }
    }
  }
  return area;
};

const scoreDecomposition = (
  grid: OccupancyGrid,
  cuboids: readonly Cuboid[]
): DecompositionScore => ({
  boxCount: cuboids.length,
  internalSeamArea: internalSeamArea(cuboids),
  aspectPenalty: cuboids.reduce(
    (total, cuboid) => total + cuboidAspectPenalty(cuboid),
    0
  ),
  lexicalSignature: cuboids
    .map((cuboid) => stableBoundsKey(grid.density, cuboid.bounds))
    .join('|')
});

const compareLexical = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareScores = (
  left: DecompositionScore,
  right: DecompositionScore
): number =>
  left.boxCount - right.boxCount ||
  left.internalSeamArea - right.internalSeamArea ||
  left.aspectPenalty - right.aspectPenalty ||
  compareLexical(left.lexicalSignature, right.lexicalSignature);

export const decomposeWithAxisOrder = (
  grid: OccupancyGrid,
  axisOrder: AxisOrder
): CuboidDecomposition => {
  assertDensity(grid.density);
  assertAxisOrder(axisOrder);
  const cells = [...grid.cells]
    .map(parseCellKey)
    .sort((left, right) => compareAlongOrder(left, right, axisOrder));
  const remaining = new Set(grid.cells);
  const cuboids: Cuboid[] = [];

  for (const seed of cells) {
    if (!remaining.has(cellKey(seed))) {
      continue;
    }
    let bounds = boundsForCell(seed);
    for (const axis of axisOrder) {
      while (canExpandPositive(bounds, axis, remaining)) {
        bounds = expandPositive(bounds, axis);
      }
    }
    removeCuboidCells(remaining, bounds);
    cuboids.push({ bounds });
  }

  cuboids.sort(compareCuboids);
  return {
    density: grid.density,
    axisOrder: [...axisOrder],
    cuboids,
    score: scoreDecomposition(grid, cuboids)
  };
};

export const decomposeOccupancy = (
  grid: OccupancyGrid
): CuboidDecomposition => {
  let best: CuboidDecomposition | undefined;
  for (const axisOrder of GREEDY_AXIS_ORDERS) {
    const candidate = decomposeWithAxisOrder(grid, axisOrder);
    if (best === undefined || compareScores(candidate.score, best.score) < 0) {
      best = candidate;
    }
  }
  if (best === undefined) {
    throw new Error('no greedy axis orders are configured');
  }
  return best;
};

export const assertExactDecomposition = (
  grid: OccupancyGrid,
  decomposition: CuboidDecomposition
): void => {
  assertDensity(grid.density);
  if (grid.density !== decomposition.density) {
    throw new Error('decomposition density does not match occupancy density');
  }

  const covered = new Set<CellKey>();
  for (const cuboid of decomposition.cuboids) {
    assertLatticePoint(cuboid.bounds.min, 'cuboid.bounds.min');
    assertLatticePoint(cuboid.bounds.max, 'cuboid.bounds.max');
    if (
      cuboid.bounds.min.x >= cuboid.bounds.max.x ||
      cuboid.bounds.min.y >= cuboid.bounds.max.y ||
      cuboid.bounds.min.z >= cuboid.bounds.max.z
    ) {
      throw new Error('cuboid bounds must have positive extent');
    }
    for (let x = cuboid.bounds.min.x; x < cuboid.bounds.max.x; x += 1) {
      for (let y = cuboid.bounds.min.y; y < cuboid.bounds.max.y; y += 1) {
        for (let z = cuboid.bounds.min.z; z < cuboid.bounds.max.z; z += 1) {
          const key = cellKey({ x, y, z });
          if (covered.has(key)) {
            throw new Error(`cuboids overlap at ${key}`);
          }
          if (!grid.cells.has(key)) {
            throw new Error(`cuboid covers unoccupied cell ${key}`);
          }
          covered.add(key);
        }
      }
    }
  }

  if (covered.size !== grid.cells.size) {
    const missing = [...grid.cells].find((key) => !covered.has(key));
    throw new Error(`decomposition does not cover occupied cell ${missing}`);
  }
};
