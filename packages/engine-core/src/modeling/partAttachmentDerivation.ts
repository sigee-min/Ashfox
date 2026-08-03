import type { SurfacePixelDensity } from '../model';
import { compareStableText } from '../stableOrder';
import { findSixConnectedComponents } from './connectivity';
import {
  comparePoints,
  createOccupancyGrid,
  parseCellKey
} from './lattice';
import {
  isGeometryPartSpec,
  type GeometryPartSpec,
  type PartSpec
} from './partContract';
import {
  canonicalPartOrder,
  PART_OCCUPANCY_POLICY
} from './partOccupancyCanonicalization';
import { partTranslation } from './partTranslation';
import { validationOccupancyForPart } from './semanticCuboidGrammar';
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

export interface PartParentInferenceFailure {
  ok: false;
  partId: string;
  message: string;
}

export interface PartParentInferenceSuccess {
  ok: true;
  parts: readonly PartSpec[];
}

export type PartParentInferenceResult =
  | PartParentInferenceFailure
  | PartParentInferenceSuccess;

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
        if (translationDistance(offset) <= maximum) {
          offsets.push(offset);
        }
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
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authored: OccupancyGrid,
  parentOccupancy: OccupancyGrid,
  offset: LatticePoint
): AttachmentCandidate | null => {
  const moved = translatedGrid(authored, offset);
  const retained = withoutParentCells(moved, parentOccupancy);
  if (retained.cells.size === 0) {
    return null;
  }
  const detached = findSixConnectedComponents(retained).some(
    (component) =>
      resolveAttachmentAnchor(
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
  if (!resolved) return null;
  return {
    offset,
    anchor: resolved.anchor,
    contactFaceCount: resolved.metric.latticeFaceCount,
    retainedCellCount: retained.cells.size
  };
};

const bestAttachmentCandidate = (
  part: GeometryPartSpec,
  parent: GeometryPartSpec,
  authored: OccupancyGrid,
  parentOccupancy: OccupancyGrid
): AttachmentCandidate | null => {
  const intersectsParent = [...authored.cells].some(
    (key) => parentOccupancy.cells.has(key)
  );
  const candidateOffsets = intersectsParent
    ? [ZERO_OFFSET]
    : snapOffsetsForDensity(authored.density);
  return candidateOffsets
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
    .sort(compareCandidates)[0] ?? null;
};

const isKnownDescendant = (
  candidateId: string,
  partId: string,
  partsById: ReadonlyMap<string, PartSpec>
): boolean => {
  const visited = new Set<string>();
  let current = partsById.get(candidateId);
  while (current) {
    const parentPartId = current.parentPartId;
    if (parentPartId === null) return false;
    if (parentPartId === partId) return true;
    if (visited.has(parentPartId)) return false;
    visited.add(parentPartId);
    current = partsById.get(parentPartId);
  }
  return false;
};

/**
 * Resolves omitted parents only from unambiguous geometric contact.
 * It never guesses articulated joints, feature ownership, or a root in a
 * multi-root authoring batch.
 */
export const inferFixedPartParents = (
  parts: readonly PartSpec[],
  omittedParentPartIds: ReadonlySet<string>,
  density: SurfacePixelDensity
): PartParentInferenceResult => {
  if (omittedParentPartIds.size === 0) {
    return { ok: true, parts };
  }
  const partsById = new Map(
    parts.map((part) => [part.partId, part])
  );
  const occupancyById = new Map(
    parts.filter(isGeometryPartSpec).map((part) => [
      part.partId,
      validationOccupancyForPart(part, density)
    ])
  );
  const explicitRoots = parts.filter(
    (part) =>
      part.parentPartId === null &&
      !omittedParentPartIds.has(part.partId)
  );
  const omitted = parts
    .filter(
      (part): part is GeometryPartSpec =>
        omittedParentPartIds.has(part.partId) &&
        isGeometryPartSpec(part)
    )
    .sort((left, right) =>
      compareStableText(left.partId, right.partId)
    );
  const implicitRootId =
    explicitRoots.length === 0 && omitted.length === 1
      ? omitted[0].partId
      : null;

  if (explicitRoots.length === 0 && implicitRootId === null) {
    return {
      ok: false,
      partId: omitted[0]?.partId ?? '',
      message:
        'A multi-part model requires one explicit root with parentPartId: null before omitted fixed parents can be inferred.'
    };
  }

  const inferredParents = new Map<string, string>();
  for (const part of omitted) {
    if (part.partId === implicitRootId) continue;
    const authored = occupancyById.get(part.partId);
    if (!authored) {
      return {
        ok: false,
        partId: part.partId,
        message:
          `Part "${part.partId}" has no validation occupancy for parent inference.`
      };
    }
    const candidates = parts
      .filter(isGeometryPartSpec)
      .filter(
        (candidate) => {
          const parentOccupancy = occupancyById.get(candidate.partId);
          return (
            candidate.partId !== part.partId &&
            !isKnownDescendant(
              candidate.partId,
              part.partId,
              partsById
            ) &&
            parentOccupancy !== undefined &&
            bestAttachmentCandidate(
              part,
              candidate,
              authored,
              parentOccupancy
            ) !== null
          );
        }
      )
      .map((candidate) => candidate.partId)
      .sort(compareStableText);
    if (candidates.length !== 1) {
      return {
        ok: false,
        partId: part.partId,
        message:
          candidates.length === 0
            ? `Part "${part.partId}" has no unique contact parent. Provide parentPartId explicitly.`
            : `Part "${part.partId}" touches multiple possible parents (${candidates.join(', ')}). Provide parentPartId explicitly.`
      };
    }
    inferredParents.set(part.partId, candidates[0]);
  }

  const inferred = parts.map((part): PartSpec => {
    const parentPartId = inferredParents.get(part.partId);
    return parentPartId === undefined
      ? part
      : {
          ...part,
          parentPartId,
          joint: { kind: 'fixed' },
          attachment: null
        };
  });
  if (!canonicalPartOrder(inferred)) {
    const first = [...inferredParents.keys()]
      .sort(compareStableText)[0] ?? '';
    return {
      ok: false,
      partId: first,
      message:
        'Geometric parent inference would create a cyclic hierarchy. Provide parentPartId explicitly.'
    };
  }
  return { ok: true, parts: inferred };
};

const withDerivedAttachment = (
  part: GeometryPartSpec,
  candidate: AttachmentCandidate
): GeometryPartSpec => {
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
    if (!isGeometryPartSpec(part)) {
      const parent = part.parentPartId === null
        ? undefined
        : resolvedById.get(part.parentPartId);
      if (!parent || !isGeometryPartSpec(parent)) {
        return {
          ok: false,
          path: `parts.${part.partId}.parentPartId`,
          message:
            `Surface feature "${part.partId}" requires a geometric parent.`
        };
      }
      resolvedById.set(part.partId, {
        ...part,
        joint: { kind: 'fixed' },
        attachment: null
      });
      continue;
    }
    if (part.parentPartId === null) {
      resolvedById.set(part.partId, part);
      occupancyById.set(
        part.partId,
        validationOccupancyForPart(part, density)
      );
      continue;
    }
    const parent = resolvedById.get(part.parentPartId);
    const parentOccupancy = occupancyById.get(
      part.parentPartId
    );
    if (!parent || !isGeometryPartSpec(parent) || !parentOccupancy) {
      return {
        ok: false,
        path: `parts.${part.partId}.parentPartId`,
        message:
          `Parent part "${part.parentPartId}" does not exist in the complete recipe.`
      };
    }
    const authored = validationOccupancyForPart(part, density);
    const intersectsParent = [...authored.cells].some(
      (key) => parentOccupancy.cells.has(key)
    );
    const candidate = bestAttachmentCandidate(
      part,
      parent,
      authored,
      parentOccupancy
    );
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
              `${PART_OCCUPANCY_POLICY.maximumAttachmentSnapDistanceBlocks} model blocks. ` +
              'Place it touching or just beside its parent.'
      };
    }
    const resolved = withDerivedAttachment(part, candidate);
    resolvedById.set(part.partId, resolved);
    occupancyById.set(
      part.partId,
      validationOccupancyForPart(resolved, density)
    );
  }

  return {
    ok: true,
    parts: parts.map((part) => resolvedById.get(part.partId) ?? part)
  };
};
