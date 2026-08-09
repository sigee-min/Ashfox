import type {
  AuthoringProfile,
  AuthoringSlotAssignment,
  AuthoringSupport
} from '../../contract';
import { supportPartIds } from './geometry';
import type {
  SupportQualityEvaluation,
  SupportQualityIssue,
  SupportQualityStatus
} from './contract';
import type { SupportReferenceEvaluation } from './references';

export interface SupportStageFindings {
  readonly issues: readonly SupportQualityIssue[];
  readonly violations: readonly SupportQualityIssue[];
}

export interface SupportSlotEvaluation extends SupportStageFindings {
  readonly status: SupportQualityStatus;
}

export interface SupportStatusMetrics {
  readonly groundContactCellCount: number;
  readonly downwardExposedSoleCellCount: number;
  readonly toeForwardMarginCells: number | null;
  readonly clawForwardMarginCells: number | null;
}

export const finalizeSupportStatus = (
  slot: AuthoringSlotAssignment,
  support: Exclude<AuthoringSupport, { kind: 'none' }>,
  references: SupportReferenceEvaluation,
  findings: SupportStageFindings,
  metrics: SupportStatusMetrics
): SupportSlotEvaluation => {
  const issues = [...references.issues, ...findings.issues];
  const violations = [...references.violations, ...findings.violations];
  return {
    status: {
      slotId: slot.slotId,
      supportKind: support.kind,
      contact: support.contact,
      state:
        violations.length > 0
          ? 'invalid'
          : references.missingPartIds.length > 0
            ? 'incomplete'
            : !references.valid || findings.issues.length > 0
              ? 'invalid'
              : 'complete',
      referencedPartIds: references.referencedPartIds,
      missingPartIds: references.missingPartIds,
      ...metrics,
      issueCodes: issues.map((entry) => entry.code)
    },
    issues,
    violations
  };
};

export const noneSupportEvaluation = (
  slot: AuthoringSlotAssignment
): SupportSlotEvaluation => ({
  status: {
    slotId: slot.slotId,
    supportKind: 'none',
    contact: null,
    state: 'not-applicable',
    referencedPartIds: [],
    missingPartIds: [],
    groundContactCellCount: 0,
    downwardExposedSoleCellCount: 0,
    toeForwardMarginCells: null,
    clawForwardMarginCells: null,
    issueCodes: []
  },
  issues: [],
  violations: []
});

export const unavailableSupportEvaluation = (
  profile: AuthoringProfile,
  entry: SupportQualityIssue
): SupportQualityEvaluation => ({
  statuses: profile.slots.map((slot) => slot.support.kind === 'none'
    ? noneSupportEvaluation(slot).status
    : {
        slotId: slot.slotId,
        supportKind: slot.support.kind,
        contact: slot.support.contact,
        state: 'invalid',
        referencedPartIds: supportPartIds(slot.support),
        missingPartIds: [],
        groundContactCellCount: 0,
        downwardExposedSoleCellCount: 0,
        toeForwardMarginCells: null,
        clawForwardMarginCells: null,
        issueCodes: [entry.code]
      }),
  issues: [entry],
  violations: [entry],
  ready: false
});

export const appendSupportIssueCodes = (
  status: SupportQualityStatus,
  issueCodes: SupportQualityStatus['issueCodes']
): SupportQualityStatus => issueCodes.length === 0
  ? status
  : {
      ...status,
      state: 'invalid',
      issueCodes: [...status.issueCodes, ...issueCodes]
    };

export const isSupportReady = (
  statuses: readonly SupportQualityStatus[],
  issues: readonly SupportQualityIssue[]
): boolean =>
  issues.length === 0 &&
  statuses.every(
    (status) =>
      status.state === 'complete' ||
      status.state === 'not-applicable'
  );
