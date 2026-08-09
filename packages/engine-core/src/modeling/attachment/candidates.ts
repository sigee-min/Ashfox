import type { SurfacePixelDensity } from '../../model';
import { findSixConnectedComponents } from '../connectivity';
import type {
  LatticeBounds,
  LatticePoint,
  OccupancyGrid
} from '../contract';
import {
  cellKey,
  comparePoints,
  createOccupancyGrid,
  parseCellKey
} from '../lattice';
import { PART_OCCUPANCY_POLICY } from '../occupancy';
import type { GeometryPartSpec } from '../part';
import { resolveAttachmentAnchor } from '../part/quality';
import { attachmentBoundsMayContact } from './bounds';

export interface AttachmentCandidate {
  offset: LatticePoint;
  anchor: LatticePoint;
  contactFaceCount: number;
  retainedCellCount: number;
}

export type AttachmentCandidateEvaluator = (
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authored: OccupancyGrid,
  parentOccupancy: OccupancyGrid
) => AttachmentCandidate | null;

export interface AttachmentCandidateMetric {
  readonly authoredCellParses: number;
  readonly parentCellParses: number;
  readonly offsetsEvaluated: number;
  readonly translatedCellEvaluations: number;
  readonly retainedGridAllocations: number;
  readonly componentGridAllocations: number;
  readonly candidatesAccepted: number;
}

export interface MeasuredAttachmentCandidate {
  readonly candidate: AttachmentCandidate | null;
  readonly metric: AttachmentCandidateMetric;
}

interface MutableAttachmentCandidateMetric {
  authoredCellParses: number;
  parentCellParses: number;
  offsetsEvaluated: number;
  translatedCellEvaluations: number;
  retainedGridAllocations: number;
  componentGridAllocations: number;
  candidatesAccepted: number;
}

interface PreparedOccupancy {
  readonly points: readonly LatticePoint[];
  readonly bounds: LatticeBounds | null;
  readonly center: LatticePoint | null;
}

interface BoundsAccumulator {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  count: number;
}

const FACE_OFFSETS: readonly LatticePoint[] = [
  { x: -1, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 }
];

const ZERO_OFFSET: LatticePoint = { x: 0, y: 0, z: 0 };

const translationDistance = (offset: LatticePoint): number =>
  Math.abs(offset.x) + Math.abs(offset.y) + Math.abs(offset.z);

const compareOffsets = (
  left: LatticePoint,
  right: LatticePoint
): number =>
  translationDistance(left) - translationDistance(right) ||
  comparePoints(left, right);

const automaticSnapOffsets = (
  density: SurfacePixelDensity
): readonly LatticePoint[] => {
  const offsets: LatticePoint[] = [];
  const maximum =
    PART_OCCUPANCY_POLICY.maximumAttachmentSnapDistanceBlocks * density;
  for (let x = -maximum; x <= maximum; x += 1) {
    for (let y = -maximum; y <= maximum; y += 1) {
      for (let z = -maximum; z <= maximum; z += 1) {
        const offset = { x, y, z };
        if (translationDistance(offset) <= maximum) offsets.push(offset);
      }
    }
  }
  return offsets.sort(compareOffsets);
};

const AUTOMATIC_SNAP_OFFSETS = new Map<
  SurfacePixelDensity,
  readonly LatticePoint[]
>();

const snapOffsetsForDensity = (
  density: SurfacePixelDensity
): readonly LatticePoint[] => {
  const existing = AUTOMATIC_SNAP_OFFSETS.get(density);
  if (existing) return existing;
  const created = automaticSnapOffsets(density);
  AUTOMATIC_SNAP_OFFSETS.set(density, created);
  return created;
};

const centerOfBounds = (bounds: LatticeBounds): LatticePoint => ({
  x: Math.floor((bounds.min.x + bounds.max.x + 1) / 2),
  y: Math.floor((bounds.min.y + bounds.max.y + 1) / 2),
  z: Math.floor((bounds.min.z + bounds.max.z + 1) / 2)
});

const emptyBounds = (): BoundsAccumulator => ({
  minX: Infinity,
  minY: Infinity,
  minZ: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
  maxZ: -Infinity,
  count: 0
});

const includePoint = (
  bounds: BoundsAccumulator,
  point: LatticePoint
): void => {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.minZ = Math.min(bounds.minZ, point.z);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
  bounds.maxZ = Math.max(bounds.maxZ, point.z);
  bounds.count += 1;
};

const completeBounds = (
  bounds: BoundsAccumulator
): LatticeBounds | null => bounds.count === 0 ? null : {
  min: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
  max: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ }
};

const prepareOccupancy = (
  grid: OccupancyGrid,
  onParse: () => void
): PreparedOccupancy => {
  const points: LatticePoint[] = [];
  const accumulator = emptyBounds();
  for (const key of grid.cells) {
    const point = parseCellKey(key);
    onParse();
    points.push(point);
    includePoint(accumulator, point);
  }
  const bounds = completeBounds(accumulator);
  if (!bounds) return { points, bounds: null, center: null };
  return { points, bounds, center: centerOfBounds(bounds) };
};

const boundsForOccupancy = (
  grid: OccupancyGrid,
  onParse: () => void
): LatticeBounds | null => {
  const accumulator = emptyBounds();
  for (const key of grid.cells) {
    includePoint(accumulator, parseCellKey(key));
    onParse();
  }
  return completeBounds(accumulator);
};

const occupanciesIntersect = (
  left: OccupancyGrid,
  right: OccupancyGrid
): boolean => {
  for (const key of left.cells) {
    if (right.cells.has(key)) return true;
  }
  return false;
};

const translatedBounds = (
  bounds: LatticeBounds,
  offset: LatticePoint
): LatticeBounds => ({
  min: {
    x: bounds.min.x + offset.x,
    y: bounds.min.y + offset.y,
    z: bounds.min.z + offset.z
  },
  max: {
    x: bounds.max.x + offset.x,
    y: bounds.max.y + offset.y,
    z: bounds.max.z + offset.z
  }
});

const translatedPoint = (
  point: LatticePoint,
  offset: LatticePoint
): LatticePoint => ({
  x: point.x + offset.x,
  y: point.y + offset.y,
  z: point.z + offset.z
});

const touchesParent = (
  point: LatticePoint,
  parentCells: ReadonlySet<string>
): boolean => FACE_OFFSETS.some((offset) => parentCells.has(cellKey({
  x: point.x + offset.x,
  y: point.y + offset.y,
  z: point.z + offset.z
})));

const compareCandidates = (
  left: AttachmentCandidate,
  right: AttachmentCandidate
): number =>
  translationDistance(left.offset) - translationDistance(right.offset) ||
  right.contactFaceCount - left.contactFaceCount ||
  right.retainedCellCount - left.retainedCellCount ||
  comparePoints(left.offset, right.offset) ||
  comparePoints(left.anchor, right.anchor);

const attachmentCandidate = (
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authored: PreparedOccupancy,
  parentBounds: LatticeBounds | null,
  density: SurfacePixelDensity,
  parentOccupancy: OccupancyGrid,
  offset: LatticePoint,
  metric: MutableAttachmentCandidateMetric
): AttachmentCandidate | null => {
  metric.offsetsEvaluated += 1;
  if (
    !authored.bounds ||
    !authored.center ||
    !parentBounds ||
    !attachmentBoundsMayContact(
      translatedBounds(authored.bounds, offset),
      parentBounds,
      0
    )
  ) {
    return null;
  }
  const retainedCells = new Set<`${number},${number},${number}`>();
  metric.retainedGridAllocations += 1;
  let hasContact = false;
  const retainedBounds = emptyBounds();
  for (const point of authored.points) {
    metric.translatedCellEvaluations += 1;
    const moved = translatedPoint(point, offset);
    const key = cellKey(moved);
    if (parentOccupancy.cells.has(key)) continue;
    retainedCells.add(key);
    hasContact ||= touchesParent(moved, parentOccupancy.cells);
    includePoint(retainedBounds, moved);
  }
  if (retainedCells.size === 0 || !hasContact) return null;
  const retained: OccupancyGrid = { density, cells: retainedCells };
  const completeRetainedBounds = completeBounds(retainedBounds);
  if (!completeRetainedBounds) return null;
  const retainedCenter = centerOfBounds(completeRetainedBounds);
  for (const component of findSixConnectedComponents(retained)) {
    metric.componentGridAllocations += 1;
    if (resolveAttachmentAnchor(
      part.partId,
      parent.partId,
      createOccupancyGrid(density, component),
      parentOccupancy,
      retainedCenter
    ) === null) {
      return null;
    }
  }
  const resolved = resolveAttachmentAnchor(
    part.partId,
    parent.partId,
    retained,
    parentOccupancy,
    translatedPoint(authored.center, offset)
  );
  return resolved ? {
    offset,
    anchor: resolved.anchor,
    contactFaceCount: resolved.metric.latticeFaceCount,
    retainedCellCount: retainedCells.size
  } : null;
};

export const bestAttachmentCandidateMeasured = (
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authoredGrid: OccupancyGrid,
  parentOccupancy: OccupancyGrid
): MeasuredAttachmentCandidate => {
  const metric: MutableAttachmentCandidateMetric = {
    authoredCellParses: 0,
    parentCellParses: 0,
    offsetsEvaluated: 0,
    translatedCellEvaluations: 0,
    retainedGridAllocations: 0,
    componentGridAllocations: 0,
    candidatesAccepted: 0
  };
  const authored = prepareOccupancy(authoredGrid, () => {
    metric.authoredCellParses += 1;
  });
  const parentBounds = boundsForOccupancy(parentOccupancy, () => {
    metric.parentCellParses += 1;
  });
  const intersectsParent = occupanciesIntersect(
    authoredGrid,
    parentOccupancy
  );
  const offsets = intersectsParent
    ? [ZERO_OFFSET]
    : snapOffsetsForDensity(authoredGrid.density);
  let best: AttachmentCandidate | null = null;
  for (const offset of offsets) {
    const candidate = attachmentCandidate(
      part,
      parent,
      authored,
      parentBounds,
      authoredGrid.density,
      parentOccupancy,
      offset,
      metric
    );
    if (!candidate) continue;
    metric.candidatesAccepted += 1;
    if (best === null || compareCandidates(candidate, best) < 0) {
      best = candidate;
    }
  }
  return { candidate: best, metric };
};

export const bestAttachmentCandidate: AttachmentCandidateEvaluator = (
  part,
  parent,
  authored,
  parentOccupancy
) => bestAttachmentCandidateMeasured(
  part,
  parent,
  authored,
  parentOccupancy
).candidate;
