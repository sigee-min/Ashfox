import type { CompiledPartState } from '../modeling/partInvariants';
import { cellKey, parseCellKey } from '../modeling/lattice';
import type { CellKey, LatticePoint } from '../modeling/types';
import {
  projectCellLateralSide,
  reflectProjectCell,
  type ProjectSpatialFrame
} from '../project/projectSpatialFrame';
import { compareStableText } from '../stableOrder';
import type {
  MutableSpanQualityEvaluation,
  SpanQualityIssue,
  SpanQualityIssueCode
} from './spanQualityTypes';

export type SpanPoint = readonly [number, number, number];
type AxisIndex = 0 | 1 | 2;
interface PlanePoint { u: number; v: number }

const NEIGHBORS: readonly LatticePoint[] = [
  { x: -1, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 }
];

export const spanQualityIssue = (
  code: SpanQualityIssueCode,
  path: string,
  message: string,
  expected: string,
  partIds: readonly string[] = []
): SpanQualityIssue => ({
  code,
  path,
  message,
  expected,
  ...(partIds.length > 0
    ? { partIds: [...new Set(partIds)].sort(compareStableText) }
    : {})
});

export const addSpanQualityIssue = (
  evaluation: MutableSpanQualityEvaluation,
  issue: SpanQualityIssue,
  violation: boolean
): void => {
  evaluation.issues.push(issue);
  if (violation) evaluation.violations.push(issue);
};

export const spanCellsForParts = (
  partIds: readonly string[],
  parts: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<CellKey> => new Set(partIds.flatMap((partId) => [
  ...(parts.get(partId)?.occupancy.cells ?? [])
]));

const translatedKey = (
  key: CellKey,
  by: LatticePoint
): CellKey => {
  const cell = parseCellKey(key);
  return cellKey({
    x: cell.x + by.x,
    y: cell.y + by.y,
    z: cell.z + by.z
  });
};

export const spanAdjacencyCount = (
  first: ReadonlySet<CellKey>,
  second: ReadonlySet<CellKey>
): number => {
  let count = 0;
  for (const key of first) {
    for (const neighbor of NEIGHBORS) {
      if (second.has(translatedKey(key, neighbor))) count += 1;
    }
  }
  return count;
};

export const spanCellsConnected = (
  cells: ReadonlySet<CellKey>
): boolean => {
  const first = cells.values().next().value as CellKey | undefined;
  if (!first) return false;
  const visited = new Set<CellKey>([first]);
  const pending: CellKey[] = [first];
  while (pending.length > 0) {
    const key = pending.pop();
    if (!key) continue;
    for (const neighbor of NEIGHBORS) {
      const next = translatedKey(key, neighbor);
      if (!cells.has(next) || visited.has(next)) continue;
      visited.add(next);
      pending.push(next);
    }
  }
  return visited.size === cells.size;
};

const cellCenter = (key: CellKey): SpanPoint => {
  const cell = parseCellKey(key);
  return [cell.x + 0.5, cell.y + 0.5, cell.z + 0.5];
};

const dot = (left: SpanPoint, right: SpanPoint): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

export const spanDirectionalRange = (
  cells: ReadonlySet<CellKey>,
  direction: SpanPoint
): { centroid: number; maximum: number } | null => {
  if (cells.size === 0) return null;
  const values = [...cells].map((key) => dot(cellCenter(key), direction));
  return {
    centroid: values.reduce((sum, value) => sum + value, 0) / values.length,
    maximum: Math.max(...values)
  };
};

const spanBounds = (
  cells: ReadonlySet<CellKey>
): { minimum: SpanPoint; maximum: SpanPoint } | null => {
  const points = [...cells].map(cellCenter);
  const first = points[0];
  if (!first) return null;
  const minimum: [number, number, number] = [...first];
  const maximum: [number, number, number] = [...first];
  for (const point of points.slice(1)) {
    for (const axis of [0, 1, 2] as const) {
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis]);
    }
  }
  return { minimum, maximum };
};

const membraneAxes = (
  cells: ReadonlySet<CellKey>
): { normal: AxisIndex; first: AxisIndex; second: AxisIndex } | null => {
  const bounds = spanBounds(cells);
  if (!bounds) return null;
  const spans = bounds.maximum.map(
    (maximum, axis) => maximum - bounds.minimum[axis]
  );
  const minimum = Math.min(...spans);
  const normals = spans.flatMap((span, axis) =>
    span === minimum ? [axis as AxisIndex] : []
  );
  if (normals.length !== 1) return null;
  const normal = normals[0];
  const planeAxes = ([0, 1, 2] as const).filter((axis) => axis !== normal);
  return { normal, first: planeAxes[0], second: planeAxes[1] };
};

const cross = (
  origin: PlanePoint,
  left: PlanePoint,
  right: PlanePoint
): number =>
  (left.u - origin.u) * (right.v - origin.v) -
  (left.v - origin.v) * (right.u - origin.u);

const convexHull = (points: readonly PlanePoint[]): readonly PlanePoint[] => {
  const ordered = [...new Map(points.map((point) => [
    `${point.u},${point.v}`,
    point
  ])).values()].sort((left, right) => left.u - right.u || left.v - right.v);
  if (ordered.length <= 2) return ordered;
  const half = (input: readonly PlanePoint[]): PlanePoint[] => {
    const result: PlanePoint[] = [];
    for (const point of input) {
      while (
        result.length >= 2 &&
        cross(result[result.length - 2], result[result.length - 1], point) <= 0
      ) {
        result.pop();
      }
      result.push(point);
    }
    return result;
  };
  return [
    ...half(ordered).slice(0, -1),
    ...half([...ordered].reverse()).slice(0, -1)
  ];
};

const pointInsideConvexHull = (
  point: PlanePoint,
  hull: readonly PlanePoint[]
): boolean => {
  if (hull.length < 3) return false;
  let direction = 0;
  for (let index = 0; index < hull.length; index += 1) {
    const value = cross(hull[index], hull[(index + 1) % hull.length], point);
    if (Math.abs(value) < 0.000001) continue;
    const sign = Math.sign(value);
    if (direction !== 0 && sign !== direction) return false;
    direction = sign;
  }
  return true;
};

export const membraneInsideSupportEnvelope = (
  membrane: ReadonlySet<CellKey>,
  support: ReadonlySet<CellKey>
): boolean => {
  const axes = membraneAxes(membrane);
  const supportBounds = spanBounds(support);
  if (!axes || !supportBounds) return false;
  const supportPoints = [...support].map(cellCenter);
  const hull = convexHull(supportPoints.map((point) => ({
    u: point[axes.first],
    v: point[axes.second]
  })));
  const minimum = supportBounds.minimum[axes.normal];
  const maximum = supportBounds.maximum[axes.normal];
  let exteriorSide: -1 | 0 | 1 = 0;
  return [...membrane].map(cellCenter).every((point) => {
    const side = point[axes.normal] < minimum
      ? -1
      : point[axes.normal] > maximum ? 1 : 0;
    // A thickness-one membrane may form one external skin of its spar/root
    // envelope. It must stay face-adjacent to that envelope; it cannot span
    // or drift across both outside sides.
    if (point[axes.normal] < minimum - 1 || point[axes.normal] > maximum + 1) {
      return false;
    }
    if (side !== 0) {
      if (exteriorSide !== 0 && exteriorSide !== side) return false;
      exteriorSide = side;
    }
    return pointInsideConvexHull({
      u: point[axes.first],
      v: point[axes.second]
    }, hull);
  });
};

export const membraneProjectedEnvelopeCoverage = (
  membrane: ReadonlySet<CellKey>,
  support: ReadonlySet<CellKey>
): number => {
  const axes = membraneAxes(membrane);
  if (!axes) return 0;
  const hull = convexHull([...support].map(cellCenter).map((point) => ({
    u: point[axes.first],
    v: point[axes.second]
  })));
  if (hull.length < 3) return 0;
  const minimumU = Math.min(...hull.map((point) => point.u));
  const maximumU = Math.max(...hull.map((point) => point.u));
  const minimumV = Math.min(...hull.map((point) => point.v));
  const maximumV = Math.max(...hull.map((point) => point.v));
  let envelopeCellCount = 0;
  for (let u = minimumU; u <= maximumU; u += 1) {
    for (let v = minimumV; v <= maximumV; v += 1) {
      if (pointInsideConvexHull({ u, v }, hull)) envelopeCellCount += 1;
    }
  }
  if (envelopeCellCount === 0) return 0;
  const membraneProjection = new Set([...membrane].map(cellCenter).map(
    (point) => `${point[axes.first]},${point[axes.second]}`
  ));
  return membraneProjection.size / envelopeCellCount;
};

export const spanGroundedPartIds = (
  partIds: readonly string[],
  parts: ReadonlyMap<string, CompiledPartState>
): readonly string[] => partIds.filter((partId) =>
  [...(parts.get(partId)?.occupancy.cells ?? [])].some(
    (key) => parseCellKey(key).y <= 0
  )
);

export const spanCrossPlanePartIds = (
  partIds: readonly string[],
  side: 'left' | 'right',
  parts: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): readonly string[] => partIds.filter((partId) =>
  [...(parts.get(partId)?.occupancy.cells ?? [])].some((key) => {
    const cell = parseCellKey(key);
    return projectCellLateralSide(
      [cell.x, cell.y, cell.z],
      frame
    ) !== side;
  })
);

export const exactSpanReflection = (
  source: ReadonlySet<CellKey>,
  target: ReadonlySet<CellKey>,
  frame: ProjectSpatialFrame
): boolean => frame.planeTwice !== null &&
  source.size === target.size &&
  [...source].every((key) => {
    const cell = parseCellKey(key);
    const reflected = reflectProjectCell(
      [cell.x, cell.y, cell.z],
      frame
    );
    return target.has(cellKey({
      x: reflected[0],
      y: reflected[1],
      z: reflected[2]
    }));
  });
