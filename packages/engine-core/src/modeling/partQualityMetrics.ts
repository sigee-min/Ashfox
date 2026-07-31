import { compareStableText } from '../stableOrder';
import {
  cellKey,
  comparePoints,
  parseCellKey,
  worldToLattice
} from './lattice';
import type { CompiledPartState } from './partInvariants/types';
import type {
  Axis,
  LatticePoint,
  OccupancyGrid
} from './types';

export interface AttachmentContactMetric {
  partId: string;
  parentPartId: string;
  /** Exact count of adjacent child-parent lattice faces. */
  latticeFaceCount: number;
  /** Contact area in square model units. */
  contactArea: number;
  /** Contact faces whose closed face rectangle contains the declared anchor. */
  anchorFaceCount: number;
}

export interface AttachmentAnchorResolution {
  anchor: LatticePoint;
  distanceCells: number;
  metric: AttachmentContactMetric;
}

export type OrthographicView =
  | 'west'
  | 'east'
  | 'down'
  | 'up'
  | 'north'
  | 'south';

export interface OrthographicContributionMetric {
  partId: string;
  view: OrthographicView;
  /** Front-most projected cells owned by this part in the selected view. */
  visibleCellCount: number;
  /** Total occupied cells in the complete model silhouette for this view. */
  silhouetteCellCount: number;
  /** visibleCellCount / silhouetteCellCount, or zero for an empty model. */
  contribution: number;
}

const FACE_OFFSETS: readonly LatticePoint[] = [
  { x: -1, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 }
];

const faceContainsAnchor = (
  cell: LatticePoint,
  offset: LatticePoint,
  anchor: LatticePoint
): boolean => {
  const axis: Axis =
    offset.x !== 0 ? 'x' : offset.y !== 0 ? 'y' : 'z';
  const plane = offset[axis] > 0
    ? cell[axis] + 1
    : cell[axis];
  const otherAxes = (['x', 'y', 'z'] as const).filter(
    (candidate) => candidate !== axis
  );
  return (
    anchor[axis] === plane &&
    otherAxes.every(
      (otherAxis) =>
        anchor[otherAxis] >= cell[otherAxis] &&
        anchor[otherAxis] <= cell[otherAxis] + 1
    )
  );
};

const nearestPointOnFace = (
  cell: LatticePoint,
  offset: LatticePoint,
  desired: LatticePoint
): LatticePoint => {
  const axis: Axis =
    offset.x !== 0 ? 'x' : offset.y !== 0 ? 'y' : 'z';
  const point = { ...desired };
  point[axis] = offset[axis] > 0
    ? cell[axis] + 1
    : cell[axis];
  for (const otherAxis of ['x', 'y', 'z'] as const) {
    if (otherAxis === axis) continue;
    point[otherAxis] = Math.max(
      cell[otherAxis],
      Math.min(cell[otherAxis] + 1, desired[otherAxis])
    );
  }
  return point;
};

const pointDistance = (
  left: LatticePoint,
  right: LatticePoint
): number =>
  Math.abs(left.x - right.x) +
  Math.abs(left.y - right.y) +
  Math.abs(left.z - right.z);

export const resolveAttachmentAnchor = (
  partId: string,
  parentPartId: string,
  occupancy: OccupancyGrid,
  parentOccupancy: OccupancyGrid,
  desiredAnchor: LatticePoint
): AttachmentAnchorResolution | null => {
  let best: LatticePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of occupancy.cells) {
    const cell = parseCellKey(key);
    for (const offset of FACE_OFFSETS) {
      if (
        !parentOccupancy.cells.has(
          cellKey({
            x: cell.x + offset.x,
            y: cell.y + offset.y,
            z: cell.z + offset.z
          })
        )
      ) {
        continue;
      }
      const candidate = nearestPointOnFace(
        cell,
        offset,
        desiredAnchor
      );
      const distance = pointDistance(candidate, desiredAnchor);
      if (
        best === null ||
        distance < bestDistance ||
        (
          distance === bestDistance &&
          comparePoints(candidate, best) < 0
        )
      ) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  if (best === null) return null;
  return {
    anchor: best,
    distanceCells: bestDistance,
    metric: attachmentContactMetric(
      partId,
      parentPartId,
      occupancy,
      parentOccupancy,
      best
    )
  };
};

export const attachmentContactMetric = (
  partId: string,
  parentPartId: string,
  occupancy: OccupancyGrid,
  parentOccupancy: OccupancyGrid,
  anchor: LatticePoint
): AttachmentContactMetric => {
  let latticeFaceCount = 0;
  let anchorFaceCount = 0;
  for (const key of occupancy.cells) {
    const cell = parseCellKey(key);
    for (const offset of FACE_OFFSETS) {
      if (
        !parentOccupancy.cells.has(
          cellKey({
            x: cell.x + offset.x,
            y: cell.y + offset.y,
            z: cell.z + offset.z
          })
        )
      ) {
        continue;
      }
      latticeFaceCount += 1;
      if (faceContainsAnchor(cell, offset, anchor)) {
        anchorFaceCount += 1;
      }
    }
  }
  return {
    partId,
    parentPartId,
    latticeFaceCount,
    contactArea:
      latticeFaceCount /
      (occupancy.density * occupancy.density),
    anchorFaceCount
  };
};

export const attachmentContactMetrics = (
  parts: ReadonlyMap<string, CompiledPartState>
): readonly AttachmentContactMetric[] => {
  const metrics: AttachmentContactMetric[] = [];
  for (const part of [...parts.values()].sort((left, right) =>
    compareStableText(left.partId, right.partId)
  )) {
    if (part.parentPartId === null) continue;
    const parent = parts.get(part.parentPartId);
    if (!parent) continue;
    const anchor: LatticePoint = {
      x: worldToLattice(
        part.bone.transform.pivot[0],
        part.occupancy.density
      ),
      y: worldToLattice(
        part.bone.transform.pivot[1],
        part.occupancy.density
      ),
      z: worldToLattice(
        part.bone.transform.pivot[2],
        part.occupancy.density
      )
    };
    metrics.push(attachmentContactMetric(
      part.partId,
      part.parentPartId,
      part.occupancy,
      parent.occupancy,
      anchor
    ));
  }
  return metrics;
};

const VIEW_SPECS: readonly {
  view: OrthographicView;
  axis: Axis;
  direction: -1 | 1;
}[] = [
  { view: 'west', axis: 'x', direction: -1 },
  { view: 'east', axis: 'x', direction: 1 },
  { view: 'down', axis: 'y', direction: -1 },
  { view: 'up', axis: 'y', direction: 1 },
  { view: 'north', axis: 'z', direction: -1 },
  { view: 'south', axis: 'z', direction: 1 }
];

const projectedKey = (
  cell: LatticePoint,
  axis: Axis
): string =>
  axis === 'x'
    ? `${cell.y},${cell.z}`
    : axis === 'y'
      ? `${cell.x},${cell.z}`
      : `${cell.x},${cell.y}`;

export const orthographicContributionMetrics = (
  parts: ReadonlyMap<string, {
    partId: string;
    occupancy: OccupancyGrid;
  }>
): readonly OrthographicContributionMetric[] => {
  const cells = [...parts.values()].flatMap((part) =>
    [...part.occupancy.cells].map((key) => ({
      partId: part.partId,
      cell: parseCellKey(key)
    }))
  );
  const metrics: OrthographicContributionMetric[] = [];
  for (const spec of VIEW_SPECS) {
    const front = new Map<string, {
      coordinate: number;
      partId: string;
    }>();
    for (const entry of cells) {
      const key = projectedKey(entry.cell, spec.axis);
      const coordinate = entry.cell[spec.axis] * spec.direction;
      const current = front.get(key);
      if (
        !current ||
        coordinate > current.coordinate ||
        (
          coordinate === current.coordinate &&
          compareStableText(entry.partId, current.partId) < 0
        )
      ) {
        front.set(key, {
          coordinate,
          partId: entry.partId
        });
      }
    }
    const counts = new Map<string, number>();
    for (const entry of front.values()) {
      counts.set(entry.partId, (counts.get(entry.partId) ?? 0) + 1);
    }
    const silhouetteCellCount = front.size;
    for (const partId of [...parts.keys()].sort(compareStableText)) {
      const visibleCellCount = counts.get(partId) ?? 0;
      metrics.push({
        partId,
        view: spec.view,
        visibleCellCount,
        silhouetteCellCount,
        contribution:
          silhouetteCellCount === 0
            ? 0
            : visibleCellCount / silhouetteCellCount
      });
    }
  }
  return metrics;
};
