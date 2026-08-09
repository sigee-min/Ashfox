import type { CompiledPartState } from '../../../modeling/invariants';
import { parseCellKey } from '../../../modeling/lattice';
import type { CellKey } from '../../../modeling/contract';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment,
  AuthoringSupport
} from '../../contract';

const EPSILON = 0.000001;

export const CANONICAL_STANDING_EXTENSION_POLICY = Object.freeze({
  minimumVerticalDropCells: 1,
  minimumVerticalPathFraction: 0.5,
  minimumCoreCentroidClearanceCells: 1
});

type Point2 = readonly [number, number];
export type RestPoint3 = readonly [number, number, number];

export const cellsForParts = (
  partIds: readonly string[],
  parts: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<CellKey> => new Set(partIds.flatMap((partId) => [
  ...(parts.get(partId)?.occupancy.cells ?? [])
]));

export const centroid = (cells: ReadonlySet<CellKey>): RestPoint3 | null => {
  if (cells.size === 0) return null;
  const sum = [...cells].reduce((current, key) => {
    const cell = parseCellKey(key);
    return [
      current[0] + cell.x + 0.5,
      current[1] + cell.y + 0.5,
      current[2] + cell.z + 0.5
    ] as RestPoint3;
  }, [0, 0, 0] as RestPoint3);
  return [sum[0] / cells.size, sum[1] / cells.size, sum[2] / cells.size];
};

const cross = (origin: Point2, first: Point2, second: Point2): number =>
  (first[0] - origin[0]) * (second[1] - origin[1]) -
  (first[1] - origin[1]) * (second[0] - origin[0]);

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

export const pointInsideHull = (
  point: Point2,
  hull: readonly Point2[]
): boolean => {
  if (hull.length === 0) return false;
  if (hull.length === 1) {
    return Math.abs(point[0] - hull[0][0]) <= EPSILON &&
      Math.abs(point[1] - hull[0][1]) <= EPSILON;
  }
  if (hull.length === 2) return pointOnSegment(point, hull[0], hull[1]);
  return hull.every((vertex, index) =>
    cross(vertex, hull[(index + 1) % hull.length], point) >= -EPSILON
  );
};

export const expectedSupportSlots = (
  profile: AuthoringProfile
): readonly AuthoringSlotAssignment[] => {
  switch (profile.restPose.mode) {
    case 'standing':
      return profile.slots.filter((slot) => slot.support.kind === 'foot');
    case 'supported':
      return profile.slots.filter((slot) => slot.support.kind === 'base');
    case 'rolling':
      return profile.slots.filter((slot) => slot.support.kind === 'wheel');
    case 'none':
    case 'free-explicit':
      return [];
  }
};

export const supportContactPartIds = (
  support: AuthoringSupport
): readonly string[] => {
  if (support.kind === 'none') return [];
  if (support.kind === 'base') return support.supportPartIds;
  if (support.kind === 'wheel') return support.wheelPartIds;
  return [
    ...support.solePartIds,
    ...support.digits.flatMap((digit) => [
      ...digit.toePartIds,
      ...digit.clawPartIds
    ])
  ];
};

export const supportContractIsConsistent = (
  profile: AuthoringProfile
): boolean => {
  const feet = profile.slots.filter((slot) => slot.support.kind === 'foot');
  const bases = profile.slots.filter((slot) => slot.support.kind === 'base');
  const wheels = profile.slots.filter((slot) => slot.support.kind === 'wheel');
  const groundedFeet = feet.filter(
    (slot) => slot.support.kind === 'foot' &&
      slot.support.contact === 'grounded'
  );
  const groundedBases = bases.filter(
    (slot) => slot.support.kind === 'base' &&
      slot.support.contact === 'grounded'
  );
  const groundedWheels = wheels.filter(
    (slot) => slot.support.kind === 'wheel' &&
      slot.support.contact === 'grounded'
  );
  switch (profile.restPose.mode) {
    case 'standing':
      return feet.length > 0 && groundedFeet.length === feet.length &&
        bases.length === 0 && wheels.length === 0;
    case 'rolling':
      return wheels.length > 0 && groundedWheels.length === wheels.length &&
        feet.length === 0 && bases.length === 0;
    case 'supported':
      return bases.length > 0 && groundedBases.length === bases.length &&
        feet.length === 0 && wheels.length === 0;
    case 'none':
    case 'free-explicit':
      return groundedFeet.length === 0 && groundedBases.length === 0 &&
        groundedWheels.length === 0;
  }
};

export const chainToCore = (
  partId: string,
  corePartIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>
): readonly CompiledPartState[] | null => {
  const chain: CompiledPartState[] = [];
  const visited = new Set<string>();
  let current = parts.get(partId);
  while (current && !visited.has(current.partId)) {
    chain.push(current);
    if (corePartIds.has(current.partId)) return chain.reverse();
    visited.add(current.partId);
    current = current.parentPartId === null
      ? undefined
      : parts.get(current.parentPartId);
  }
  return null;
};

export const chainDescends = (
  chain: readonly CompiledPartState[]
): boolean => {
  const centers = chain.map((part) => centroid(part.occupancy.cells));
  if (centers.some((center) => center === null)) return false;
  const concrete = centers as readonly RestPoint3[];
  const first = concrete[0];
  const last = concrete.at(-1)!;
  const verticalDrop = first[1] - last[1];
  const totalPathLength = concrete.slice(1).reduce((length, point, index) => {
    const previous = concrete[index];
    return length + Math.hypot(
      point[0] - previous[0],
      point[1] - previous[1],
      point[2] - previous[2]
    );
  }, 0);
  const policy = CANONICAL_STANDING_EXTENSION_POLICY;
  return verticalDrop >= policy.minimumVerticalDropCells - EPSILON &&
    totalPathLength > EPSILON &&
    verticalDrop / totalPathLength >=
      policy.minimumVerticalPathFraction - EPSILON &&
    concrete.every((center, index) =>
      index === 0 || center[1] <= concrete[index - 1][1] + EPSILON
    );
};

export const REST_GEOMETRY_EPSILON = EPSILON;
