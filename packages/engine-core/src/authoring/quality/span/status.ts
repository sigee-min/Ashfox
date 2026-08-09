import type {
  AuthoringSlotAssignment
} from '../../contract';
import type {
  SpanQualityEvaluation,
  SpanQualityIssue,
  SpanQualityIssueCode,
  SpanQualityStatus,
  SpanReferenceEvaluation,
  SpanSlotEvaluation,
  SpanStageFindings
} from './contract';

export const noneSpanStatus = (
  slot: AuthoringSlotAssignment
): SpanQualityStatus => ({
  slotId: slot.slotId,
  spanKind: 'none',
  state: 'not-applicable',
  referencedPartIds: [],
  missingPartIds: [],
  issueCodes: []
});

export const noneSpanEvaluation = (
  slot: AuthoringSlotAssignment
): SpanSlotEvaluation => ({
  status: noneSpanStatus(slot),
  issues: [],
  violations: []
});

export const finalizeSpanStatus = (
  slot: AuthoringSlotAssignment,
  references: SpanReferenceEvaluation,
  stages: readonly SpanStageFindings[]
): SpanSlotEvaluation => {
  const issues = [
    ...references.issues,
    ...stages.flatMap((stage) => stage.issues)
  ];
  const violations = [
    ...references.violations,
    ...stages.flatMap((stage) => stage.violations)
  ];
  return {
    status: {
      slotId: slot.slotId,
      spanKind: 'supported-surface',
      state: references.missingPartIds.length > 0
        ? 'incomplete'
        : issues.length > 0
          ? 'invalid'
          : 'complete',
      referencedPartIds: references.referencedPartIds,
      missingPartIds: references.missingPartIds,
      issueCodes: issues.map((entry) => entry.code)
    },
    issues,
    violations
  };
};

export const unavailableSpanEvaluation = (
  slots: readonly AuthoringSlotAssignment[],
  entry: SpanQualityIssue
): SpanQualityEvaluation => ({
  statuses: slots.map((slot) => ({
    slotId: slot.slotId,
    spanKind: slot.span.kind,
    state: 'invalid',
    referencedPartIds: slot.partIds,
    missingPartIds: [],
    issueCodes: [entry.code]
  })),
  issues: [entry],
  violations: [entry],
  ready: false
});

export const appendSpanPairCodes = (
  status: SpanQualityStatus,
  codes: readonly SpanQualityIssueCode[]
): SpanQualityStatus => ({
  ...status,
  issueCodes: [...status.issueCodes, ...codes],
  state: codes.length > 0 ? 'invalid' : status.state
});

export const compareSpanIssue = (
  left: SpanQualityIssue,
  right: SpanQualityIssue
): number =>
  left.path.localeCompare(right.path) ||
  left.code.localeCompare(right.code);

export const spanQualityReady = (
  statuses: readonly SpanQualityStatus[],
  issues: readonly SpanQualityIssue[]
): boolean =>
  statuses.every((status) =>
    status.state === 'complete' || status.state === 'not-applicable'
  ) && issues.length === 0;
