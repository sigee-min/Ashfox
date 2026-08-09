import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection
} from '../../model';
import { cellKey } from '../lattice';
import { compareCuboids } from '../cuboid/operations';
import type {
  Axis,
  CellKey,
  Cuboid,
  LatticeBounds,
  LatticePoint
} from '../contract';

/**
 * A compiled cuboid is allowed to own a face only when that whole rectangular
 * face has one meaning: it is either all outside the solid or all inside it.
 * A mixed face would contain an external patch and an internal coplanar seam
 * in one CubeNode, which the project format cannot represent safely.
 */
export type SurfaceFaceOwnership = 'external' | 'internal' | 'mixed';

export interface SurfaceOwnershipInput {
  ownerId: string;
  cuboid: Cuboid;
}

export interface SurfaceOwnedCuboid extends SurfaceOwnershipInput {
  faces: Readonly<Record<CubeFaceDirection, SurfaceFaceOwnership>>;
}

export type SurfaceOwnershipResult =
  | {
      ok: true;
      cuboids: readonly SurfaceOwnedCuboid[];
      occupancy: ReadonlySet<CellKey>;
    }
  | {
      ok: false;
      message: string;
    };

interface FaceAxes {
  normal: Axis;
  first: Axis;
  second: Axis;
  positive: boolean;
}

interface MutableLatticeBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

const FACE_AXES: Readonly<Record<CubeFaceDirection, FaceAxes>> = {
  north: { normal: 'z', first: 'x', second: 'y', positive: false },
  south: { normal: 'z', first: 'x', second: 'y', positive: true },
  east: { normal: 'x', first: 'z', second: 'y', positive: true },
  west: { normal: 'x', first: 'z', second: 'y', positive: false },
  up: { normal: 'y', first: 'x', second: 'z', positive: true },
  down: { normal: 'y', first: 'x', second: 'z', positive: false }
};

const MAX_SURFACE_OWNED_CUBOIDS = 65_536;

const intervalOverlaps = (
  leftMin: number,
  leftMax: number,
  rightMin: number,
  rightMax: number
): boolean => leftMin < rightMax && leftMax > rightMin;

const clampBoundary = (
  value: number,
  minimum: number,
  maximum: number
): number => Math.max(minimum, Math.min(maximum, value));

const sortedCuts = (
  cuts: ReadonlySet<number>
): readonly number[] => [...cuts].sort((left, right) => left - right);

const occupancyFor = (
  cuboids: readonly SurfaceOwnershipInput[]
): ReadonlySet<CellKey> | null => {
  const occupancy = new Set<CellKey>();
  for (const { cuboid } of cuboids) {
    const { min, max } = cuboid.bounds;
    for (let x = min.x; x < max.x; x += 1) {
      for (let y = min.y; y < max.y; y += 1) {
        for (let z = min.z; z < max.z; z += 1) {
          const key = cellKey({ x, y, z });
          if (occupancy.has(key)) return null;
          occupancy.add(key);
        }
      }
    }
  }
  return occupancy;
};

const boundaryCell = (
  bounds: LatticeBounds,
  axes: FaceAxes,
  first: number,
  second: number
): LatticePoint => ({
  [axes.normal]: axes.positive
    ? bounds.max[axes.normal] - 1
    : bounds.min[axes.normal],
  [axes.first]: first,
  [axes.second]: second
} as LatticePoint);

/** Classifies a whole cuboid face against the canonical solid occupancy. */
export const classifySurfaceFace = (
  bounds: LatticeBounds,
  direction: CubeFaceDirection,
  occupancy: ReadonlySet<CellKey>
): SurfaceFaceOwnership => {
  const axes = FACE_AXES[direction];
  let external = false;
  let internal = false;
  for (
    let first = bounds.min[axes.first];
    first < bounds.max[axes.first];
    first += 1
  ) {
    for (
      let second = bounds.min[axes.second];
      second < bounds.max[axes.second];
      second += 1
    ) {
      const boundary = boundaryCell(bounds, axes, first, second);
      const neighbor: LatticePoint = {
        ...boundary,
        [axes.normal]: boundary[axes.normal] + (axes.positive ? 1 : -1)
      };
      if (occupancy.has(cellKey(neighbor))) internal = true;
      else external = true;
      if (external && internal) return 'mixed';
    }
  }
  return external ? 'external' : 'internal';
};

const addFaceCuts = (
  target: LatticeBounds,
  candidate: LatticeBounds,
  direction: CubeFaceDirection,
  cuts: Record<Axis, Set<number>>
): void => {
  const axes = FACE_AXES[direction];
  const targetPlane = axes.positive
    ? target.max[axes.normal]
    : target.min[axes.normal];
  const candidateBoundary = axes.positive
    ? candidate.min[axes.normal]
    : candidate.max[axes.normal];
  if (candidateBoundary !== targetPlane) return;
  if (
    !intervalOverlaps(
      target.min[axes.first],
      target.max[axes.first],
      candidate.min[axes.first],
      candidate.max[axes.first]
    ) ||
    !intervalOverlaps(
      target.min[axes.second],
      target.max[axes.second],
      candidate.min[axes.second],
      candidate.max[axes.second]
    )
  ) {
    return;
  }
  for (const axis of [axes.first, axes.second]) {
    cuts[axis].add(clampBoundary(
      candidate.min[axis],
      target.min[axis],
      target.max[axis]
    ));
    cuts[axis].add(clampBoundary(
      candidate.max[axis],
      target.min[axis],
      target.max[axis]
    ));
  }
};

const partitionAtCuts = (
  input: SurfaceOwnershipInput,
  cuts: Record<Axis, Set<number>>
): readonly SurfaceOwnershipInput[] => {
  const xCuts = sortedCuts(cuts.x);
  const yCuts = sortedCuts(cuts.y);
  const zCuts = sortedCuts(cuts.z);
  const result: SurfaceOwnershipInput[] = [];
  for (let x = 1; x < xCuts.length; x += 1) {
    for (let y = 1; y < yCuts.length; y += 1) {
      for (let z = 1; z < zCuts.length; z += 1) {
        result.push({
          ownerId: input.ownerId,
          cuboid: {
            bounds: {
              min: {
                x: xCuts[x - 1]!,
                y: yCuts[y - 1]!,
                z: zCuts[z - 1]!
              },
              max: { x: xCuts[x]!, y: yCuts[y]!, z: zCuts[z]! }
            }
          }
        });
      }
    }
  }
  return result;
};

const splitForMixedFace = (
  input: SurfaceOwnershipInput,
  direction: CubeFaceDirection,
  source: readonly SurfaceOwnershipInput[]
): readonly SurfaceOwnershipInput[] => {
  const axes = FACE_AXES[direction];
  const { bounds } = input.cuboid;
  const normalExtent = bounds.max[axes.normal] - bounds.min[axes.normal];
  const slabBounds: MutableLatticeBounds = normalExtent === 1
    ? bounds
    : {
        min: { ...bounds.min },
        max: { ...bounds.max }
      };
  const interior: SurfaceOwnershipInput[] = [];
  if (normalExtent > 1) {
    if (axes.positive) {
      slabBounds.min[axes.normal] = bounds.max[axes.normal] - 1;
      interior.push({
        ownerId: input.ownerId,
        cuboid: {
          bounds: {
            min: { ...bounds.min },
            max: {
              ...bounds.max,
              [axes.normal]: bounds.max[axes.normal] - 1
            }
          }
        }
      });
    } else {
      slabBounds.max[axes.normal] = bounds.min[axes.normal] + 1;
      interior.push({
        ownerId: input.ownerId,
        cuboid: {
          bounds: {
            min: {
              ...bounds.min,
              [axes.normal]: bounds.min[axes.normal] + 1
            },
            max: { ...bounds.max }
          }
        }
      });
    }
  }
  const cuts: Record<Axis, Set<number>> = {
    x: new Set([slabBounds.min.x, slabBounds.max.x]),
    y: new Set([slabBounds.min.y, slabBounds.max.y]),
    z: new Set([slabBounds.min.z, slabBounds.max.z])
  };
  for (const candidate of source) {
    addFaceCuts(slabBounds, candidate.cuboid.bounds, direction, cuts);
  }
  const slab = partitionAtCuts(
    { ownerId: input.ownerId, cuboid: { bounds: slabBounds } },
    cuts
  );
  return [...interior, ...slab];
};

const compareSurfaceOwnedCuboids = (
  left: SurfaceOwnershipInput,
  right: SurfaceOwnershipInput
): number => left.ownerId.localeCompare(right.ownerId) ||
  compareCuboids(left.cuboid, right.cuboid);

/**
 * Splits only at attached-cuboid patch boundaries. The result retains the
 * exact solid volume while guaranteeing that one output CubeNode face can be
 * wholly enabled or wholly disabled. That gives generated atlas, viewport,
 * and exported geometry one shared, exact surface authority.
 */
export const partitionSurfaceOwnedCuboids = (
  input: readonly SurfaceOwnershipInput[]
): SurfaceOwnershipResult => {
  const ordered = [...input].sort(compareSurfaceOwnedCuboids);
  const occupancy = occupancyFor(ordered);
  if (!occupancy) {
    return {
      ok: false,
      message: 'Canonical surface ownership requires disjoint lattice cuboids.'
    };
  }
  const pending = [...ordered];
  const cuboids: SurfaceOwnedCuboid[] = [];
  let pendingIndex = 0;
  while (pendingIndex < pending.length) {
    const partition = pending[pendingIndex]!;
    pendingIndex += 1;
    const faces = Object.fromEntries(
      CUBE_FACE_DIRECTIONS.map((direction) => [
        direction,
        classifySurfaceFace(partition.cuboid.bounds, direction, occupancy)
      ])
    ) as Record<CubeFaceDirection, SurfaceFaceOwnership>;
    const mixed = CUBE_FACE_DIRECTIONS.find(
      (direction) => faces[direction] === 'mixed'
    );
    if (mixed) {
      const split = splitForMixedFace(partition, mixed, ordered);
      if (split.length <= 1) {
        return {
          ok: false,
          message:
            `Canonical surface ownership could not split mixed ${mixed} ` +
            `face on part "${partition.ownerId}".`
        };
      }
      pending.push(...[...split].sort(compareSurfaceOwnedCuboids));
      if (
        pending.length - pendingIndex + cuboids.length >
          MAX_SURFACE_OWNED_CUBOIDS
      ) {
        return {
          ok: false,
          message:
            'Canonical surface ownership exceeds the safe emitted-cuboid budget.'
        };
      }
      continue;
    }
    cuboids.push({ ...partition, faces });
  }
  return {
    ok: true,
    cuboids: cuboids.sort(compareSurfaceOwnedCuboids),
    occupancy
  };
};
