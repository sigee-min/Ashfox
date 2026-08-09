import type { ProjectDocument } from '../../../model';
import { readCompiledParts } from '../../../modeling/invariants';
import { projectSpatialFrame } from '../../../project/frame';
import { validateSpanPairReflections } from '../../reflection/span';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../../contract';
import {
  evaluateSpanMembranes,
  MIN_SPAN_MEMBRANE_ENVELOPE_COVERAGE
} from './membranes';
import { evaluateSpanPlacement } from './placement';
import { evaluateSpanReferences } from './references';
import { evaluateSpanRoots } from './roots';
import { evaluateSpanSpars } from './spars';
import {
  appendSpanPairCodes,
  compareSpanIssue,
  finalizeSpanStatus,
  noneSpanEvaluation,
  noneSpanStatus,
  spanQualityReady,
  unavailableSpanEvaluation
} from './status';
import { spanQualityIssue as issue } from './geometry';
import type {
  MutableSpanQualityEvaluation,
  SpanEvaluationContext,
  SpanQualityEvaluation,
  SpanQualityStatus,
  SpanSlotEvaluation,
  SupportedSpan
} from './contract';

export { MIN_SPAN_MEMBRANE_ENVELOPE_COVERAGE };
export type {
  SpanQualityEvaluation,
  SpanQualityIssue,
  SpanQualityIssueCode,
  SpanQualityState,
  SpanQualityStatus
} from './contract';

const evaluateSupportedSpan = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  profile: AuthoringProfile,
  context: SpanEvaluationContext
): SpanSlotEvaluation => {
  const references = evaluateSpanReferences(slot, span, context);
  return finalizeSpanStatus(
    slot,
    references,
    references.missingPartIds.length > 0
      ? []
      : [
          evaluateSpanRoots(slot, span, profile, context),
          evaluateSpanSpars(slot, span, context),
          evaluateSpanMembranes(slot, span, context),
          evaluateSpanPlacement(slot, references.referencedPartIds, context)
        ]
  );
};

export const evaluateSpanQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): SpanQualityEvaluation => {
  const slots = profile.slots.filter((slot) =>
    slot.structuralRole === 'span' || slot.span.kind !== 'none'
  );
  const noneStatuses = profile.slots
    .filter((slot) => !slots.includes(slot))
    .map(noneSpanStatus);
  if (slots.length === 0) {
    return { statuses: noneStatuses, issues: [], violations: [], ready: true };
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok || !document.intent) {
    return unavailableSpanEvaluation(slots, issue(
      'authoring.plan.span_evaluation_unavailable',
      'authoringProfile.slots',
      'Canonical span occupancy is unavailable for evaluation.',
      'valid compiled part occupancy and normalized project intent'
    ));
  }
  const context: SpanEvaluationContext = {
    document,
    parts: compiled.parts,
    frame: projectSpatialFrame(document.intent)
  };
  const slotEvaluations = slots.map((slot) =>
    slot.span.kind === 'supported-surface'
      ? evaluateSupportedSpan(slot, slot.span, profile, context)
      : noneSpanEvaluation(slot)
  );
  const pairEvaluation: MutableSpanQualityEvaluation = {
    issues: [],
    violations: []
  };
  const pairCodes = validateSpanPairReflections(
    profile,
    context,
    pairEvaluation
  );
  const statuses = [
    ...noneStatuses,
    ...slotEvaluations.map((evaluation) => evaluation.status)
  ].map((status): SpanQualityStatus => appendSpanPairCodes(
    status,
    pairCodes.get(status.slotId) ?? []
  )).sort((left, right) => left.slotId.localeCompare(right.slotId));
  const issues = [
    ...slotEvaluations.flatMap((evaluation) => evaluation.issues),
    ...pairEvaluation.issues
  ].sort(compareSpanIssue);
  const violations = [
    ...slotEvaluations.flatMap((evaluation) => evaluation.violations),
    ...pairEvaluation.violations
  ].sort(compareSpanIssue);
  return {
    statuses,
    issues,
    violations,
    ready: spanQualityReady(statuses, issues)
  };
};
