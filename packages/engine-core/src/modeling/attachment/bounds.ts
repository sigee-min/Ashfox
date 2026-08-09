import type { SurfacePixelDensity } from '../../model';
import { compareStableText } from '../../stableOrder';
import { parseCellKey } from '../lattice';
import { PART_OCCUPANCY_POLICY } from '../occupancy';
import type {
  Axis,
  LatticeBounds,
  OccupancyGrid
} from '../contract';

const AXES: readonly Axis[] = ['x', 'y', 'z'];

const occupancyBounds = (grid: OccupancyGrid): LatticeBounds | null => {
  let minimum = { x: Infinity, y: Infinity, z: Infinity };
  let maximum = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const key of grid.cells) {
    const cell = parseCellKey(key);
    minimum = {
      x: Math.min(minimum.x, cell.x),
      y: Math.min(minimum.y, cell.y),
      z: Math.min(minimum.z, cell.z)
    };
    maximum = {
      x: Math.max(maximum.x, cell.x),
      y: Math.max(maximum.y, cell.y),
      z: Math.max(maximum.z, cell.z)
    };
  }
  return grid.cells.size === 0 ? null : { min: minimum, max: maximum };
};

const axisGap = (
  left: LatticeBounds,
  right: LatticeBounds,
  axis: Axis
): number => left.max[axis] < right.min[axis]
  ? right.min[axis] - left.max[axis]
  : right.max[axis] < left.min[axis]
    ? left.min[axis] - right.max[axis]
    : 0;

/** Necessary bound for overlap or face contact after one bounded L1 snap. */
export const attachmentBoundsMayContact = (
  left: LatticeBounds,
  right: LatticeBounds,
  maximumSnapCells: number
): boolean => AXES.reduce(
  (distance, axis) => distance + axisGap(left, right, axis),
  0
) <= maximumSnapCells + 1;

const binKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

const binRange = (
  minimum: number,
  maximum: number,
  size: number
): readonly [number, number] => [
  Math.floor(minimum / size),
  Math.floor(maximum / size)
];

const binsForBounds = (
  bounds: LatticeBounds,
  size: number,
  expansion: number
): readonly string[] => {
  const [minimumX, maximumX] = binRange(
    bounds.min.x - expansion,
    bounds.max.x + expansion,
    size
  );
  const [minimumY, maximumY] = binRange(
    bounds.min.y - expansion,
    bounds.max.y + expansion,
    size
  );
  const [minimumZ, maximumZ] = binRange(
    bounds.min.z - expansion,
    bounds.max.z + expansion,
    size
  );
  const keys: string[] = [];
  for (let x = minimumX; x <= maximumX; x += 1) {
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let z = minimumZ; z <= maximumZ; z += 1) {
        keys.push(binKey(x, y, z));
      }
    }
  }
  return keys;
};

export interface AttachmentParentBroadPhase {
  candidatePartIds(partId: string): readonly string[];
}

/** Immutable spatial lookup; exact occupancy evaluation remains authoritative. */
export const createAttachmentParentBroadPhase = (
  occupancyById: ReadonlyMap<string, OccupancyGrid>,
  density: SurfacePixelDensity
): AttachmentParentBroadPhase => {
  const maximumSnapCells =
    PART_OCCUPANCY_POLICY.maximumAttachmentSnapDistanceBlocks * density;
  const reach = maximumSnapCells + 1;
  const boundsById = new Map(
    [...occupancyById].flatMap(([partId, occupancy]) => {
      const bounds = occupancyBounds(occupancy);
      return bounds ? [[partId, bounds] as const] : [];
    })
  );
  const mutableIdsByBin = new Map<string, Set<string>>();
  for (const [partId, bounds] of boundsById) {
    for (const key of binsForBounds(bounds, reach, reach)) {
      const ids = mutableIdsByBin.get(key);
      if (ids) ids.add(partId);
      else mutableIdsByBin.set(key, new Set([partId]));
    }
  }
  const idsByBin: ReadonlyMap<string, readonly string[]> = new Map(
    [...mutableIdsByBin].map(([key, ids]) => [
      key,
      [...ids].sort(compareStableText)
    ])
  );
  return {
    candidatePartIds: (partId) => {
      const bounds = boundsById.get(partId);
      if (!bounds) return [];
      const nearby = new Set<string>();
      for (const key of binsForBounds(bounds, reach, 0)) {
        for (const candidateId of idsByBin.get(key) ?? []) {
          const candidateBounds = boundsById.get(candidateId);
          if (
            candidateBounds &&
            attachmentBoundsMayContact(
              bounds,
              candidateBounds,
              maximumSnapCells
            )
          ) {
            nearby.add(candidateId);
          }
        }
      }
      return [...nearby].sort(compareStableText);
    }
  };
};
