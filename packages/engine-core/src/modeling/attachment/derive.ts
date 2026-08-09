import type { SurfacePixelDensity } from '../../model';
import {
  isGeometryPartSpec,
  type GeometryPartSpec,
  type PartSpec
} from '../part';
import {
  canonicalPartOrder,
  PART_OCCUPANCY_POLICY
} from '../occupancy';
import { partTranslation } from '../part/translate';
import {
  attachmentReflectionMaps,
  withReflectedDerivedAttachment
} from './reflect';
import {
  areLatticeCellSetsExactReflections
} from '../recipe/transforms/geometry';
import { validationOccupancyForPart } from '../cuboid/grammar';
import type { OccupancyGrid } from '../contract';
import {
  bestAttachmentCandidate,
  type AttachmentCandidate
} from './candidates';
import type {
  PartAttachmentDerivationOptions,
  PartAttachmentDerivationResult,
  PartParentInferenceResult
} from './contract';
import { inferFixedPartParentsMeasured } from './parent';

export type {
  PartAttachmentDerivationOptions,
  PartAttachmentDerivationResult,
  PartParentInferenceResult
} from './contract';

/**
 * Resolves omitted parents only from unambiguous geometric contact.
 * It never guesses articulated joints, feature ownership, or a root in a
 * multi-root authoring batch.
 */
export const inferFixedPartParents = (
  parts: readonly PartSpec[],
  omittedParentPartIds: ReadonlySet<string>,
  density: SurfacePixelDensity
): PartParentInferenceResult => inferFixedPartParentsMeasured(
  parts,
  omittedParentPartIds,
  density
).result;

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
  density: SurfacePixelDensity,
  options: PartAttachmentDerivationOptions = {}
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

  const reflectionMaps = attachmentReflectionMaps(
    ordered,
    options.reflection
  );
  if ('ok' in reflectionMaps) return reflectionMaps;

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
    const sourcePartId = reflectionMaps.sourceByReflected.get(
      part.partId
    );
    if (sourcePartId) {
      const source = resolvedById.get(sourcePartId);
      const sourceOccupancy = occupancyById.get(sourcePartId);
      const expectedParentPartId = source?.parentPartId === null
        ? null
        : source?.parentPartId === undefined
          ? undefined
          : reflectionMaps.reflectedBySource.get(source.parentPartId) ??
            source.parentPartId;
      if (
        !source ||
        !isGeometryPartSpec(source) ||
        !sourceOccupancy ||
        source.kind !== part.kind ||
        expectedParentPartId !== part.parentPartId
      ) {
        return {
          ok: false,
          path: `parts.${part.partId}`,
          message:
            `Reflected part "${part.partId}" must mirror the resolved ` +
            `geometry and parent relationship of "${sourcePartId}".`
        };
      }
      const reflected = withReflectedDerivedAttachment(
        part,
        source,
        options.reflection!.frame
      );
      if (!reflected) {
        return {
          ok: false,
          path: `parts.${part.partId}.attachment`,
          message:
            `Reflected part "${part.partId}" requires a resolved source attachment.`
        };
      }
      const reflectedOccupancy = validationOccupancyForPart(
        reflected,
        density
      );
      if (!areLatticeCellSetsExactReflections(
        sourceOccupancy.cells,
        reflectedOccupancy.cells,
        options.reflection!.frame.lateralAxis,
        options.reflection!.frame.plane!
      )) {
        return {
          ok: false,
          path: `parts.${part.partId}`,
          message:
            `Reflected part "${part.partId}" no longer exactly mirrors ` +
            `"${sourcePartId}" after attachment derivation.`
        };
      }
      resolvedById.set(part.partId, reflected);
      occupancyById.set(part.partId, reflectedOccupancy);
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
