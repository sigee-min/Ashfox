import type { SurfacePixelDensity } from '../../model';
import { compareStableText } from '../../stableOrder';
import { validationOccupancyForPart } from '../cuboid/grammar';
import type { OccupancyGrid } from '../contract';
import {
  isGeometryPartSpec,
  type GeometryPartSpec,
  type PartSpec
} from '../part';
import { canonicalPartOrder } from '../occupancy';
import {
  bestAttachmentCandidate,
  type AttachmentCandidateEvaluator
} from './candidates';
import { createAttachmentParentBroadPhase } from './bounds';
import type { PartParentInferenceResult } from './contract';

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

export type ParentCandidateSelector = (
  part: GeometryPartSpec,
  geometryParts: readonly GeometryPartSpec[],
  occupancyById: ReadonlyMap<string, OccupancyGrid>
) => readonly GeometryPartSpec[];

export interface PartParentInferenceMeasureOptions {
  readonly selectCandidates?: ParentCandidateSelector;
  readonly evaluateCandidate?: AttachmentCandidateEvaluator;
}

export interface PartParentInferenceMetric {
  readonly candidateEvaluations: number;
  readonly candidateSelections: number;
}

export interface MeasuredPartParentInference {
  readonly result: PartParentInferenceResult;
  readonly metric: PartParentInferenceMetric;
}

const measured = (
  result: PartParentInferenceResult,
  candidateEvaluations: number,
  candidateSelections: number
): MeasuredPartParentInference => ({
  result,
  metric: { candidateEvaluations, candidateSelections }
});

/** Internal measured execution used to prove broad-phase parity and cost. */
export const inferFixedPartParentsMeasured = (
  parts: readonly PartSpec[],
  omittedParentPartIds: ReadonlySet<string>,
  density: SurfacePixelDensity,
  options: PartParentInferenceMeasureOptions = {}
): MeasuredPartParentInference => {
  if (omittedParentPartIds.size === 0) {
    return measured({ ok: true, parts }, 0, 0);
  }
  const partsById = new Map(parts.map((part) => [part.partId, part]));
  const geometryParts = parts.filter(isGeometryPartSpec);
  const geometryById = new Map(
    geometryParts.map((part) => [part.partId, part])
  );
  const occupancyById = new Map(geometryParts.map((part) => [
    part.partId,
    validationOccupancyForPart(part, density)
  ]));
  const broadPhase = createAttachmentParentBroadPhase(occupancyById, density);
  const selectCandidates = options.selectCandidates ?? ((part) => {
    return broadPhase.candidatePartIds(part.partId).flatMap((partId) => {
      const candidate = geometryById.get(partId);
      return candidate ? [candidate] : [];
    });
  });
  const evaluateCandidate = options.evaluateCandidate ?? bestAttachmentCandidate;
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
    .sort((left, right) => compareStableText(left.partId, right.partId));
  const implicitRootId = explicitRoots.length === 0 && omitted.length === 1
    ? omitted[0].partId
    : null;
  if (explicitRoots.length === 0 && implicitRootId === null) {
    return measured({
      ok: false,
      partId: omitted[0]?.partId ?? '',
      message:
        'A multi-part model requires one explicit root with parentPartId: null before omitted fixed parents can be inferred.'
    }, 0, 0);
  }

  let candidateEvaluations = 0;
  let candidateSelections = 0;
  const inferredParents = new Map<string, string>();
  for (const part of omitted) {
    if (part.partId === implicitRootId) continue;
    const authored = occupancyById.get(part.partId);
    if (!authored) {
      return measured({
        ok: false,
        partId: part.partId,
        message:
          `Part "${part.partId}" has no validation occupancy for parent inference.`
      }, candidateEvaluations, candidateSelections);
    }
    const selectedCandidates = selectCandidates(
      part,
      geometryParts,
      occupancyById
    );
    candidateSelections += selectedCandidates.length;
    const candidates = selectedCandidates.filter((candidate) => {
      const parentOccupancy = occupancyById.get(candidate.partId);
      if (
        candidate.partId === part.partId ||
        isKnownDescendant(candidate.partId, part.partId, partsById) ||
        parentOccupancy === undefined
      ) {
        return false;
      }
      candidateEvaluations += 1;
      return evaluateCandidate(
        part,
        candidate,
        authored,
        parentOccupancy
      ) !== null;
    }).map((candidate) => candidate.partId).sort(compareStableText);
    if (candidates.length !== 1) {
      return measured({
        ok: false,
        partId: part.partId,
        message: candidates.length === 0
          ? `Part "${part.partId}" has no unique contact parent. Provide parentPartId explicitly.`
          : `Part "${part.partId}" touches multiple possible parents (${candidates.join(', ')}). Provide parentPartId explicitly.`
      }, candidateEvaluations, candidateSelections);
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
    const first = [...inferredParents.keys()].sort(compareStableText)[0] ?? '';
    return measured({
      ok: false,
      partId: first,
      message:
        'Geometric parent inference would create a cyclic hierarchy. Provide parentPartId explicitly.'
    }, candidateEvaluations, candidateSelections);
  }
  return measured(
    { ok: true, parts: inferred },
    candidateEvaluations,
    candidateSelections
  );
};
