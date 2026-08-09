import { canonicalJsonString } from '../../canonicalJson';
import type { CompiledPartState } from '../../modeling/invariants';
import { exactCompiledPartRigReflection } from './rig';
import type { AuthoringSpan } from '../span/contract';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../contract';
import {
  addSpanQualityIssue,
  exactSpanReflection,
  spanCellsForParts,
  spanQualityIssue
} from '../quality/span/geometry';
import type {
  MutableSpanQualityEvaluation,
  SpanEvaluationContext,
  SpanQualityIssueCode
} from '../quality/span/contract';

type SupportedSpan = Extract<AuthoringSpan, { kind: 'supported-surface' }>;
interface SemanticRegion {
  label: string;
  partIds: readonly string[];
}

const spanForSlot = (
  slot: AuthoringSlotAssignment
): AuthoringSpan => slot.span;

const supportedSpan = (
  slot: AuthoringSlotAssignment
): SupportedSpan | null => {
  const span = spanForSlot(slot);
  return span.kind === 'supported-surface' ? span : null;
};

const semanticRegions = (
  span: SupportedSpan
): readonly SemanticRegion[] => [
  { label: 'root', partIds: span.rootPartIds },
  ...span.spars.map((spar) => ({
    label: `spar:${spar.sparId}`,
    partIds: spar.partIds
  })),
  ...span.membranes.map((membrane) => ({
    label: `membrane:${membrane.membraneId}`,
    partIds: membrane.partIds
  }))
];

const membraneBoundarySignature = (
  span: SupportedSpan
): readonly string[] => span.membranes.map((membrane) =>
  `${membrane.membraneId}:${membrane.boundedBySparIds.join(',')}`
).sort((left, right) => left.localeCompare(right));

const exactPartReflection = (
  left: CompiledPartState,
  right: CompiledPartState,
  context: SpanEvaluationContext
): boolean =>
  left.primitive === right.primitive &&
  left.materialId === right.materialId &&
  exactSpanReflection(left.occupancy.cells, right.occupancy.cells, context.frame) &&
  exactCompiledPartRigReflection(
    left,
    right,
    context.document,
    context.frame
  );

const matchRegionParts = (
  leftIds: readonly string[],
  rightIds: readonly string[],
  context: SpanEvaluationContext
): ReadonlyMap<string, string> | null => {
  if (leftIds.length !== rightIds.length) return null;
  const available = new Set(rightIds);
  const mapping = new Map<string, string>();
  for (const leftId of [...leftIds].sort((a, b) => a.localeCompare(b))) {
    const left = context.parts.get(leftId);
    if (!left) return null;
    const rightId = [...available]
      .sort((a, b) => a.localeCompare(b))
      .find((candidateId) => {
        const right = context.parts.get(candidateId);
        return right ? exactPartReflection(left, right, context) : false;
      });
    if (!rightId) return null;
    mapping.set(leftId, rightId);
    available.delete(rightId);
  }
  return mapping;
};

const ownerSlot = (
  partId: string,
  profile: AuthoringProfile
): AuthoringSlotAssignment | null => profile.slots.find((candidate) =>
    candidate.partIds.includes(partId)
  ) ?? null;

const ownerSlotsReflect = (
  left: AuthoringSlotAssignment,
  right: AuthoringSlotAssignment
): boolean => left.symmetry.kind === 'paired'
  ? right.symmetry.kind === 'paired' &&
    left.symmetry.pairId === right.symmetry.pairId &&
    left.spatialRelations.includes('left') &&
    right.spatialRelations.includes('right')
  : left.slotId === right.slotId;

const exactParentLineage = (
  left: AuthoringSlotAssignment,
  right: AuthoringSlotAssignment,
  mapping: ReadonlyMap<string, string>,
  profile: AuthoringProfile,
  context: SpanEvaluationContext
): boolean => {
  const leftOwned = new Set(left.partIds);
  const rightOwned = new Set(right.partIds);
  const externalMapping = new Map<string, string>();
  const mappedRightExternalIds = new Set<string>();
  for (const [leftId, rightId] of mapping) {
    const leftParent = context.parts.get(leftId)?.parentPartId ?? null;
    const rightParent = context.parts.get(rightId)?.parentPartId ?? null;
    if (leftParent !== null && leftOwned.has(leftParent)) {
      if (mapping.get(leftParent) !== rightParent) return false;
      continue;
    }
    if (rightParent !== null && rightOwned.has(rightParent)) return false;
    if (leftParent === null || rightParent === null) {
      if (leftParent !== rightParent) return false;
      continue;
    }
    const leftOwner = ownerSlot(leftParent, profile);
    const rightOwner = ownerSlot(rightParent, profile);
    const leftParentPart = context.parts.get(leftParent);
    const rightParentPart = context.parts.get(rightParent);
    if (
      !leftOwner ||
      !rightOwner ||
      !ownerSlotsReflect(leftOwner, rightOwner) ||
      !leftParentPart ||
      !rightParentPart ||
      !exactPartReflection(leftParentPart, rightParentPart, context)
    ) return false;
    const mappedExternal = externalMapping.get(leftParent);
    if (mappedExternal !== undefined && mappedExternal !== rightParent) {
      return false;
    }
    if (
      mappedExternal === undefined &&
      mappedRightExternalIds.has(rightParent)
    ) return false;
    externalMapping.set(leftParent, rightParent);
    mappedRightExternalIds.add(rightParent);
  }
  return true;
};

const pairMismatchLabels = (
  left: AuthoringSlotAssignment,
  right: AuthoringSlotAssignment,
  profile: AuthoringProfile,
  context: SpanEvaluationContext
): readonly string[] => {
  const leftSpan = supportedSpan(left);
  const rightSpan = supportedSpan(right);
  if (!leftSpan || !rightSpan) return ['contract-kind'];
  const leftRegions = semanticRegions(leftSpan);
  const rightByLabel = new Map(
    semanticRegions(rightSpan).map((region) => [region.label, region])
  );
  const mismatches: string[] = [];
  const mapping = new Map<string, string>();
  if (
    canonicalJsonString(membraneBoundarySignature(leftSpan)) !==
    canonicalJsonString(membraneBoundarySignature(rightSpan))
  ) {
    mismatches.push('membrane-boundaries');
  }
  for (const leftRegion of leftRegions) {
    const rightRegion = rightByLabel.get(leftRegion.label);
    if (!rightRegion) {
      mismatches.push(leftRegion.label);
      continue;
    }
    if (!exactSpanReflection(
      spanCellsForParts(leftRegion.partIds, context.parts),
      spanCellsForParts(rightRegion.partIds, context.parts),
      context.frame
    )) {
      mismatches.push(leftRegion.label);
      continue;
    }
    const regionMapping = matchRegionParts(
      leftRegion.partIds,
      rightRegion.partIds,
      context
    );
    if (!regionMapping) {
      mismatches.push(leftRegion.label);
      continue;
    }
    for (const [leftId, rightId] of regionMapping) {
      mapping.set(leftId, rightId);
    }
  }
  if (
    leftRegions.length !== rightByLabel.size ||
    mapping.size !== left.partIds.length ||
    !exactParentLineage(left, right, mapping, profile, context)
  ) {
    mismatches.push('parent-lineage');
  }
  return [...new Set(mismatches)].sort((a, b) => a.localeCompare(b));
};

export const validateSpanPairReflections = (
  profile: AuthoringProfile,
  context: SpanEvaluationContext,
  evaluation: MutableSpanQualityEvaluation
): ReadonlyMap<string, readonly SpanQualityIssueCode[]> => {
  const codesBySlotId = new Map<string, SpanQualityIssueCode[]>();
  if (context.frame.planeTwice === null) return codesBySlotId;
  const pairs = new Map<string, AuthoringSlotAssignment[]>();
  for (const slot of profile.slots) {
    if (slot.symmetry.kind !== 'paired' || !supportedSpan(slot)) continue;
    pairs.set(slot.symmetry.pairId, [
      ...(pairs.get(slot.symmetry.pairId) ?? []),
      slot
    ]);
  }
  for (const [pairId, slots] of pairs) {
    const left = slots.find((slot) => slot.spatialRelations.includes('left'));
    const right = slots.find((slot) => slot.spatialRelations.includes('right'));
    if (!left || !right) continue;
    const allPartIds = [...left.partIds, ...right.partIds];
    const presentCount = allPartIds.filter((partId) =>
      context.parts.has(partId)
    ).length;
    if (presentCount === 0) continue;
    const complete = presentCount === allPartIds.length;
    const mismatches = complete
      ? pairMismatchLabels(left, right, profile, context)
      : ['materialization'];
    if (mismatches.length === 0) continue;
    const entry = spanQualityIssue(
      'authoring.plan.span_pair_reflection_invalid',
      `authoringProfile.slots.${pairId}.span`,
      `Span pair "${pairId}" has non-reflected semantic regions: ` +
        `${mismatches.join(', ')}.`,
      'root, each sparId, and each membraneId reflected exactly by per-part geometry, material, parent lineage, pivot, and joint',
      allPartIds
    );
    addSpanQualityIssue(evaluation, entry, true);
    for (const slot of [left, right]) {
      codesBySlotId.set(slot.slotId, [
        ...(codesBySlotId.get(slot.slotId) ?? []),
        entry.code
      ]);
    }
  }
  return codesBySlotId;
};
