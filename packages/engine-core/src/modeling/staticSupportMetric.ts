import { parseCellKey } from './lattice';
import type { CellKey } from './types';

const EPSILON = 0.000001;

type Point2 = readonly [number, number];

export interface StaticSupportMetric {
  occupiedCellCount: number;
  supportCellCount: number;
  projectedFootprintCellCount: number;
  centerOfMass: Point2 | null;
  supportHull: readonly Point2[];
  supportHullArea: number;
  stable: boolean | null;
}

const comparePoints = (left: Point2, right: Point2): number =>
  left[0] - right[0] || left[1] - right[1];

const cross = (
  origin: Point2,
  first: Point2,
  second: Point2
): number =>
  (first[0] - origin[0]) * (second[1] - origin[1]) -
  (first[1] - origin[1]) * (second[0] - origin[0]);

const convexHull = (points: readonly Point2[]): readonly Point2[] => {
  const unique = [
    ...new Map(
      points.map((point) => [`${point[0]},${point[1]}`, point])
    ).values()
  ].sort(comparePoints);
  if (unique.length <= 1) return unique;

  const lower: Point2[] = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower.at(-2)!, lower.at(-1)!, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point2[] = [];
  for (const point of [...unique].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper.at(-2)!, upper.at(-1)!, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

const polygonArea = (polygon: readonly Point2[]): number => {
  if (polygon.length < 3) return 0;
  let doubledArea = 0;
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    doubledArea += point[0] * next[1] - next[0] * point[1];
  });
  return Math.abs(doubledArea) / 2;
};

const pointOnSegment = (
  point: Point2,
  start: Point2,
  end: Point2
): boolean =>
  Math.abs(cross(start, end, point)) <= EPSILON &&
  point[0] >= Math.min(start[0], end[0]) - EPSILON &&
  point[0] <= Math.max(start[0], end[0]) + EPSILON &&
  point[1] >= Math.min(start[1], end[1]) - EPSILON &&
  point[1] <= Math.max(start[1], end[1]) + EPSILON;

const pointInsideConvexHull = (
  point: Point2,
  hull: readonly Point2[]
): boolean => {
  if (hull.length === 0) return false;
  if (hull.length === 1) {
    return (
      Math.abs(point[0] - hull[0][0]) <= EPSILON &&
      Math.abs(point[1] - hull[0][1]) <= EPSILON
    );
  }
  if (hull.length === 2) {
    return pointOnSegment(point, hull[0], hull[1]);
  }
  return hull.every(
    (vertex, index) =>
      cross(vertex, hull[(index + 1) % hull.length], point) >=
      -EPSILON
  );
};

export const measureStaticSupport = (
  cellKeys: Iterable<CellKey>,
  groundY = 0
): StaticSupportMetric => {
  const uniqueCellKeys = new Set(cellKeys);
  if (uniqueCellKeys.size === 0) {
    return {
      occupiedCellCount: 0,
      supportCellCount: 0,
      projectedFootprintCellCount: 0,
      centerOfMass: null,
      supportHull: [],
      supportHullArea: 0,
      stable: null
    };
  }

  let sumX = 0;
  let sumZ = 0;
  let supportCellCount = 0;
  const supportExtentsByX = new Map<
    number,
    { minimumZ: number; maximumZ: number }
  >();
  const projectedFootprint = new Set<string>();
  for (const key of uniqueCellKeys) {
    const cell = parseCellKey(key);
    sumX += cell.x + 0.5;
    sumZ += cell.z + 0.5;
    projectedFootprint.add(`${cell.x},${cell.z}`);
    if (cell.y === groundY) {
      supportCellCount += 1;
      for (const x of [cell.x, cell.x + 1]) {
        const current = supportExtentsByX.get(x);
        supportExtentsByX.set(x, {
          minimumZ: Math.min(current?.minimumZ ?? cell.z, cell.z),
          maximumZ: Math.max(
            current?.maximumZ ?? cell.z + 1,
            cell.z + 1
          )
        });
      }
    }
  }

  // At one x coordinate only the lowest and highest contact corners can be
  // vertices of the convex hull. Keeping those exact extrema avoids
  // materializing four points per occupied ground cell at the document
  // occupancy limit without changing the support polygon.
  const supportCorners: Point2[] = [];
  for (const [x, extent] of supportExtentsByX) {
    supportCorners.push([x, extent.minimumZ]);
    if (extent.maximumZ !== extent.minimumZ) {
      supportCorners.push([x, extent.maximumZ]);
    }
  }
  const supportHull = convexHull(supportCorners);
  const centerOfMass: Point2 = [
    sumX / uniqueCellKeys.size,
    sumZ / uniqueCellKeys.size
  ];
  return {
    occupiedCellCount: uniqueCellKeys.size,
    supportCellCount,
    projectedFootprintCellCount: projectedFootprint.size,
    centerOfMass,
    supportHull,
    supportHullArea: polygonArea(supportHull),
    stable:
      supportCellCount > 0 &&
      pointInsideConvexHull(centerOfMass, supportHull)
  };
};
