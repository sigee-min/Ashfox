import type { AuthoringSlotAssignment } from '../../contract';
import { compareStableText } from '../../../stableOrder';
import {
  addSpanQualityIssue as addIssue,
  spanQualityIssue as issue
} from './geometry';
import type {
  MutableSpanQualityEvaluation,
  SpanEvaluationContext,
  SpanReferenceEvaluation,
  SupportedSpan
} from './contract';

export const spanReferencedPartIds = (
  span: SupportedSpan
): readonly string[] => [
  ...span.rootPartIds,
  ...span.spars.flatMap((spar) => spar.partIds),
  ...span.membranes.flatMap((membrane) => membrane.partIds)
].sort(compareStableText);

export const reachesSpanSupport = (
  partId: string,
  supportPartIds: ReadonlySet<string>,
  sameRegionPartIds: ReadonlySet<string>,
  context: SpanEvaluationContext
): boolean => {
  const visited = new Set<string>();
  let parentPartId = context.parts.get(partId)?.parentPartId ?? null;
  while (parentPartId !== null && !visited.has(parentPartId)) {
    if (supportPartIds.has(parentPartId)) return true;
    if (!sameRegionPartIds.has(parentPartId)) return false;
    visited.add(parentPartId);
    parentPartId = context.parts.get(parentPartId)?.parentPartId ?? null;
  }
  return false;
};

export const evaluateSpanReferences = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: SpanEvaluationContext
): SpanReferenceEvaluation => {
  const evaluation: MutableSpanQualityEvaluation = {
    issues: [],
    violations: []
  };
  const referencedPartIds = spanReferencedPartIds(span);
  const missingPartIds = referencedPartIds.filter(
    (partId) => !context.parts.has(partId)
  );
  if (missingPartIds.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.span_part_missing',
      `authoringProfile.slots.${slot.slotId}.span`,
      `Span slot "${slot.slotId}" is not fully materialized.`,
      'compile every declared root, spar, and membrane part before delivery',
      missingPartIds
    ), false);
  } else {
    const segmentIds = [
      ...span.rootPartIds,
      ...span.spars.flatMap((spar) => spar.partIds)
    ];
    const plateIds = span.membranes.flatMap((membrane) => membrane.partIds);
    const invalid = [
      ...segmentIds.filter((partId) =>
        context.parts.get(partId)?.primitive !== 'segment'
      ),
      ...plateIds.filter((partId) =>
        context.parts.get(partId)?.primitive !== 'plate'
      )
    ];
    if (invalid.length > 0) {
      addIssue(evaluation, issue(
        'authoring.plan.span_part_kind_invalid',
        `authoringProfile.slots.${slot.slotId}.span`,
        `Span slot "${slot.slotId}" assigns primitives to the wrong semantic regions.`,
        'root and spar parts compiled as segment; membrane parts compiled as plate',
        invalid
      ), true);
    }
  }
  return {
    referencedPartIds,
    missingPartIds,
    issues: evaluation.issues,
    violations: evaluation.violations
  };
};
