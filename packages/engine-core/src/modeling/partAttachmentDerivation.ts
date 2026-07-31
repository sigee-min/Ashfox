import type { SurfacePixelDensity } from '../model';
import { isSixConnected } from './connectivity';
import {
  comparePoints,
  createOccupancyGrid,
  parseCellKey
} from './lattice';
import type { PartSpec } from './partContract';
import {
  canonicalPartOrder,
  PART_OCCUPANCY_POLICY
} from './partOccupancyCanonicalization';
import {
  partTranslation,
  rasterizePart
} from './partPrimitiveAdapter';
import {
  resolveAttachmentAnchor
} from './partQualityMetrics';
import type {
  LatticePoint,
  OccupancyGrid
} from './types';

export interface PartAttachmentDerivationFailure {
  ok: false;
  path: string;
  message: string;
}

export interface PartAttachmentDerivationSuccess {
  ok: true;
  parts: readonly PartSpec[];
}

export type PartAttachmentDerivationResult =
  | PartAttachmentDerivationFailure
  | PartAttachmentDerivationSuccess;

interface AttachmentCandidate {
  offset: LatticePoint;
  anchor: LatticePoint;
  contactFaceCount: number;
  retainedCellCount: number;
}

const ZERO_OFFSET: LatticePoint = { x: 0, y: 0, z: 0 };

const translationDistance = (offset: LatticePoint): number =>
  Math.abs(offset.x) + Math.abs(offset.y) + Math.abs(offset.z);

const compareOffsets = (
  left: LatticePoint,
  right: LatticePoint
): number =>
  translationDistance(left) - translationDistance(right) ||
  comparePoints(left, right);

const automaticSnapOffsets = (): readonly LatticePoint[] => {
  const offsets: LatticePoint[] = [];
  const maximum =
    PART_OCCUPANCY_POLICY.maximumTrimDepthCells;
  for (let x = -maximum; x <= maximum; x += 1) {
    for (let y = -maximum; y <= maximum; y += 1) {
      for (let z = -maximum; z <= maximum; z += 1) {
        const offset = { x, y, z };
        if (translationDistance(offset) <= maximum) {
          offsets.push(offset);
        }
      }
    }
  }
  return offsets.sort(compareOffsets);
};

const AUTOMATIC_SNAP_OFFSETS = automaticSnapOffsets();

const translatedGrid = (
  grid: OccupancyGrid,
  offset: LatticePoint
): OccupancyGrid =>
  createOccupancyGrid(
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
): OccupancyGrid =>
  createOccupancyGrid(
    child.density,
    [...child.cells]
      .filter((key) => !parent.cells.has(key))
      .map(parseCellKey)
  );

const centerOfGrid = (grid: OccupancyGrid): LatticePoint => {
  const cells = [...grid.cells].map(parseCellKey);
  const coordinate = (
    axis: 'x' | 'y' | 'z'
  ): number => {
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
  translationDistance(left.offset) -
    translationDistance(right.offset) ||
  right.contactFaceCount - left.contactFaceCount ||
  right.retainedCellCount - left.retainedCellCount ||
  comparePoints(left.offset, right.offset) ||
  comparePoints(left.anchor, right.anchor);

const attachmentCandidate = (
  part: PartSpec,
  parent: PartSpec,
  authored: OccupancyGrid,
  parentOccupancy: OccupancyGrid,
  offset: LatticePoint
): AttachmentCandidate | null => {
  const moved = translatedGrid(authored, offset);
  const retained = withoutParentCells(moved, parentOccupancy);
  if (retained.cells.size === 0 || !isSixConnected(retained)) {
    return null;
  }
  const resolved = resolveAttachmentAnchor(
    part.partId,
    parent.partId,
    retained,
    parentOccupancy,
    centerOfGrid(moved)
  );
  if (!resolved) return null;
  return {
    offset,
    anchor: resolved.anchor,
    contactFaceCount: resolved.metric.latticeFaceCount,
    retainedCellCount: retained.cells.size
  };
};

const withDerivedAttachment = (
  part: PartSpec,
  candidate: AttachmentCandidate
): PartSpec => {
  const previous = partTranslation(part);
  const translation = {
    x: previous.x + candidate.offset.x,
    y: previous.y + candidate.offset.y,
    z: previous.z + candidate.offset.z
  };
  return {
    ...part,
    attachment: {
      parentAnchor: [
        candidate.anchor.x,
        candidate.anchor.y,
        candidate.anchor.z
      ],
      partAnchor: [
        candidate.anchor.x - translation.x,
        candidate.anchor.y - translation.y,
        candidate.anchor.z - translation.z
      ]
    }
  };
};

/**
 * Completes the internal PartSpec recipe from project-space authoring input.
 * Existing internal attachments provide only the current world translation;
 * every child anchor and pivot is rederived from the resulting geometry.
 */
export const derivePartAttachments = (
  parts: readonly PartSpec[],
  density: SurfacePixelDensity
): PartAttachmentDerivationResult => {
  const ordered = canonicalPartOrder(parts);
  if (!ordered) {
    return {
      ok: false,
      path: 'parts',
      message:
        'Part hierarchy must contain unique IDs, existing parents, and no cycles.'
    };
  }

  const resolvedById = new Map<string, PartSpec>();
  const occupancyById = new Map<string, OccupancyGrid>();
  for (const part of ordered) {
    if (part.parentPartId === null) {
      resolvedById.set(part.partId, part);
      occupancyById.set(
        part.partId,
        rasterizePart(density, part)
      );
      continue;
    }
    const parent = resolvedById.get(part.parentPartId);
    const parentOccupancy = occupancyById.get(
      part.parentPartId
    );
    if (!parent || !parentOccupancy) {
      return {
        ok: false,
        path: `parts.${part.partId}.parentPartId`,
        message:
          `Parent part "${part.parentPartId}" does not exist in the complete recipe.`
      };
    }
    const authored = rasterizePart(density, part);
    const intersectsParent = [...authored.cells].some(
      (key) => parentOccupancy.cells.has(key)
    );
    const candidateOffsets = intersectsParent
      ? [ZERO_OFFSET]
      : AUTOMATIC_SNAP_OFFSETS;
    const candidate = candidateOffsets
      .map((offset) =>
        attachmentCandidate(
          part,
          parent,
          authored,
          parentOccupancy,
          offset
        )
      )
      .filter(
        (entry): entry is AttachmentCandidate => entry !== null
      )
      .sort(compareCandidates)[0];
    if (!candidate) {
      return {
        ok: false,
        path: `parts.${part.partId}.parentPartId`,
        message:
          intersectsParent
            ? `Part "${part.partId}" is fully contained by or disconnected ` +
              'after overlap with its parent. Keep a visible volume outside ' +
              'the parent surface.'
            : `Part "${part.partId}" has no shared parent face within ` +
              `${PART_OCCUPANCY_POLICY.maximumTrimDepthCells} lattice cells. ` +
              'Place it touching or just beside its parent.'
      };
    }
    const resolved = withDerivedAttachment(part, candidate);
    resolvedById.set(part.partId, resolved);
    occupancyById.set(
      part.partId,
      rasterizePart(density, resolved)
    );
  }

  return {
    ok: true,
    parts: parts.map((part) => resolvedById.get(part.partId) ?? part)
  };
};
