import type { SurfacePixelDensity } from '../../../src/model';
import type { AttachmentCandidate } from '../../../src/modeling/attachment/candidates';
import { findSixConnectedComponents } from '../../../src/modeling/connectivity';
import type {
  LatticePoint,
  OccupancyGrid
} from '../../../src/modeling/contract';
import {
  comparePoints,
  createOccupancyGrid,
  parseCellKey
} from '../../../src/modeling/lattice';
import { PART_OCCUPANCY_POLICY } from '../../../src/modeling/occupancy';
import type { GeometryPartSpec } from '../../../src/modeling/part';
import { resolveAttachmentAnchor } from '../../../src/modeling/part/quality';

const ZERO_OFFSET: LatticePoint = { x: 0, y: 0, z: 0 };

const translationDistance = (offset: LatticePoint): number =>
  Math.abs(offset.x) + Math.abs(offset.y) + Math.abs(offset.z);

const compareOffsets = (
  left: LatticePoint,
  right: LatticePoint
): number => translationDistance(left) - translationDistance(right) ||
  comparePoints(left, right);

const offsetsForDensity = (
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

const translatedGrid = (
  grid: OccupancyGrid,
  offset: LatticePoint
): OccupancyGrid => createOccupancyGrid(
  grid.density,
  [...grid.cells].map((key) => {
    const cell = parseCellKey(key);
    return {
      x: cell.x + offset.x,
      y: cell.y + offset.y,
      z: cell.z + offset.z
    };
  })
);

const withoutParentCells = (
  child: OccupancyGrid,
  parent: OccupancyGrid
): OccupancyGrid => createOccupancyGrid(
  child.density,
  [...child.cells]
    .filter((key) => !parent.cells.has(key))
    .map(parseCellKey)
);

const centerOfGrid = (grid: OccupancyGrid): LatticePoint => {
  const cells = [...grid.cells].map(parseCellKey);
  const coordinate = (axis: 'x' | 'y' | 'z'): number => {
    const minimum = Math.min(...cells.map((cell) => cell[axis]));
    const maximum = Math.max(...cells.map((cell) => cell[axis]));
    return Math.floor((minimum + maximum + 1) / 2);
  };
  return {
    x: coordinate('x'),
    y: coordinate('y'),
    z: coordinate('z')
  };
};

const compareCandidates = (
  left: AttachmentCandidate,
  right: AttachmentCandidate
): number =>
  translationDistance(left.offset) - translationDistance(right.offset) ||
  right.contactFaceCount - left.contactFaceCount ||
  right.retainedCellCount - left.retainedCellCount ||
  comparePoints(left.offset, right.offset) ||
  comparePoints(left.anchor, right.anchor);

const candidateForOffset = (
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authored: OccupancyGrid,
  parentOccupancy: OccupancyGrid,
  offset: LatticePoint
): AttachmentCandidate | null => {
  const moved = translatedGrid(authored, offset);
  const retained = withoutParentCells(moved, parentOccupancy);
  if (retained.cells.size === 0) return null;
  const detached = findSixConnectedComponents(retained).some(
    (component) => resolveAttachmentAnchor(
      part.partId,
      parent.partId,
      createOccupancyGrid(retained.density, component),
      parentOccupancy,
      centerOfGrid(retained)
    ) === null
  );
  if (detached) return null;
  const resolved = resolveAttachmentAnchor(
    part.partId,
    parent.partId,
    retained,
    parentOccupancy,
    centerOfGrid(moved)
  );
  return resolved ? {
    offset,
    anchor: resolved.anchor,
    contactFaceCount: resolved.metric.latticeFaceCount,
    retainedCellCount: retained.cells.size
  } : null;
};

export const referenceAttachmentCandidate = (
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authored: OccupancyGrid,
  parentOccupancy: OccupancyGrid
): AttachmentCandidate | null => {
  const intersectsParent = [...authored.cells].some(
    (key) => parentOccupancy.cells.has(key)
  );
  return (intersectsParent ? [ZERO_OFFSET] : offsetsForDensity(authored.density))
    .map((offset) => candidateForOffset(
      part,
      parent,
      authored,
      parentOccupancy,
      offset
    ))
    .filter((candidate): candidate is AttachmentCandidate => candidate !== null)
    .sort(compareCandidates)[0] ?? null;
};
