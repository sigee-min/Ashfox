import type { AuthoringPlanIssue } from '../../plan/contract';
import type { AuthoringRestPoseMode } from '../../contract';

export type RestPoseQualityState = 'incomplete' | 'invalid' | 'complete';

export interface RestPoseQualityStatus {
  kind: 'canonical-neutral';
  mode: AuthoringRestPoseMode;
  state: RestPoseQualityState;
  coreSlotId: string | null;
  supportSlotIds: readonly string[];
  groundContactPartIds: readonly string[];
  nonSupportGroundContactPartIds: readonly string[];
  invalidHierarchyPartIds: readonly string[];
  invalidDescentPartIds: readonly string[];
  coreAboveSupport: boolean | null;
  centerOfMassSupported: boolean | null;
}

export interface RestPoseQualityEvaluation {
  status: RestPoseQualityStatus;
  issues: readonly AuthoringPlanIssue[];
  /** Existing materialized geometry that violates canonical neutral rest. */
  violations: readonly AuthoringPlanIssue[];
  ready: boolean;
}

/** One immutable result boundary shared by the independent rest stages. */
export interface RestQualityStage<Value> {
  readonly value: Value;
  readonly issues: readonly AuthoringPlanIssue[];
  readonly violations: readonly AuthoringPlanIssue[];
}
