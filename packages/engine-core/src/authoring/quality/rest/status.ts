import type { AuthoringPlanIssue } from '../../plan/contract';
import type { AuthoringRestPoseMode } from '../../contract';
import type {
  RestPoseQualityState,
  RestPoseQualityStatus
} from './contract';

export const emptyRestPoseStatus = (
  mode: AuthoringRestPoseMode,
  state: RestPoseQualityState
): RestPoseQualityStatus => ({
  kind: 'canonical-neutral',
  mode,
  state,
  coreSlotId: null,
  supportSlotIds: [],
  groundContactPartIds: [],
  nonSupportGroundContactPartIds: [],
  invalidHierarchyPartIds: [],
  invalidDescentPartIds: [],
  coreAboveSupport: null,
  centerOfMassSupported: null
});

interface RestPoseStatusInput {
  readonly mode: AuthoringRestPoseMode;
  readonly coreSlotId: string | null;
  readonly supportSlotIds: readonly string[];
  readonly groundContactPartIds: readonly string[];
  readonly nonSupportGroundContactPartIds: readonly string[];
  readonly invalidHierarchyPartIds: readonly string[];
  readonly invalidDescentPartIds: readonly string[];
  readonly coreAboveSupport: boolean | null;
  readonly centerOfMassSupported: boolean | null;
  readonly missingPartIds: readonly string[];
  readonly issues: readonly AuthoringPlanIssue[];
  readonly violations: readonly AuthoringPlanIssue[];
}

export const createRestPoseStatus = (
  input: RestPoseStatusInput
): RestPoseQualityStatus => ({
  kind: 'canonical-neutral',
  mode: input.mode,
  state: input.violations.length > 0
    ? 'invalid'
    : input.missingPartIds.length > 0 || input.issues.length > 0
      ? 'incomplete'
      : 'complete',
  coreSlotId: input.coreSlotId,
  supportSlotIds: input.supportSlotIds,
  groundContactPartIds: input.groundContactPartIds,
  nonSupportGroundContactPartIds: input.nonSupportGroundContactPartIds,
  invalidHierarchyPartIds: input.invalidHierarchyPartIds,
  invalidDescentPartIds: input.invalidDescentPartIds,
  coreAboveSupport: input.coreAboveSupport,
  centerOfMassSupported: input.centerOfMassSupported
});
