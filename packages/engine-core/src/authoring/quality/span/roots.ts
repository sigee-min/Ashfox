import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../../contract';
import {
  addSpanQualityIssue as addIssue,
  spanQualityIssue as issue
} from './geometry';
import type {
  MutableSpanQualityEvaluation,
  SpanEvaluationContext,
  SpanStageFindings,
  SupportedSpan
} from './contract';

export const evaluateSpanRoots = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  profile: AuthoringProfile,
  context: SpanEvaluationContext
): SpanStageFindings => {
  const evaluation: MutableSpanQualityEvaluation = {
    issues: [],
    violations: []
  };
  const parentPartIds = new Set(profile.slots
    .filter((candidate) => slot.parentSlotIds.includes(candidate.slotId))
    .flatMap((candidate) => candidate.partIds));
  const invalid = span.rootPartIds.filter((partId) => {
    const parentPartId = context.parts.get(partId)?.parentPartId ?? null;
    return parentPartId === null || !parentPartIds.has(parentPartId);
  });
  if (invalid.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.span_root_parent_invalid',
      `authoringProfile.slots.${slot.slotId}.span.rootPartIds`,
      `Span roots in slot "${slot.slotId}" do not attach directly to its declared parent slots.`,
      'every root segment directly parented to a part owned by parentSlotIds',
      invalid
    ), true);
  }
  return evaluation;
};
