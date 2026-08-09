import type { AssetQualityEvaluation } from '../../quality/asset';
import type {
  AuthoringCompatibilityResult,
  AuthoringProfile
} from '../../contract';
import type {
  AuthoringPlanIssue,
  AuthoringSlotStatus
} from '../contract';

/** Immutable public result of the authoring-plan pipeline. */
export interface AuthoringPlanEvaluation {
  readonly selected: boolean;
  readonly profile: AuthoringProfile | null;
  readonly profileValid: boolean;
  readonly routingAligned: boolean;
  readonly compatibility: AuthoringCompatibilityResult;
  readonly slots: readonly AuthoringSlotStatus[];
  readonly assetQuality: AssetQualityEvaluation | null;
  readonly incompleteSlotIds: readonly string[];
  readonly unassignedPartIds: readonly string[];
  readonly issues: readonly AuthoringPlanIssue[];
  readonly ready: boolean;
}

export const EMPTY_AUTHORING_COMPATIBILITY: AuthoringCompatibilityResult =
  Object.freeze({ compatible: false, issues: Object.freeze([]) });
