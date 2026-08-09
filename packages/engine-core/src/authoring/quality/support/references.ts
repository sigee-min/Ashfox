import type { AuthoringSlotAssignment } from '../../contract';
import { compareStableText } from '../../../stableOrder';
import {
  addSupportQualityIssue as addIssue,
  duplicateValues,
  supportPartIds,
  supportQualityIssue as issue
} from './geometry';
import type {
  MutableSupportEvaluation,
  SupportEvaluationContext,
  SupportQualityIssue
} from './contract';

export interface SupportReferenceEvaluation {
  readonly referencedPartIds: readonly string[];
  readonly missingPartIds: readonly string[];
  readonly valid: boolean;
  readonly issues: readonly SupportQualityIssue[];
  readonly violations: readonly SupportQualityIssue[];
}

export const evaluateSupportReferences = (
  slot: AuthoringSlotAssignment,
  context: SupportEvaluationContext
): SupportReferenceEvaluation => {
  const evaluation: MutableSupportEvaluation = { issues: [], violations: [] };
  const referencedPartIds = supportPartIds(slot.support);
  const owned = new Set(slot.partIds);
  const unowned = referencedPartIds.filter((partId) => !owned.has(partId));
  if (unowned.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_part_unowned',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Support contract for slot "${slot.slotId}" references parts outside the slot.`,
      'support regions using only part IDs owned by this slot',
      unowned
    ), true);
  }
  const duplicates = duplicateValues(referencedPartIds);
  if (duplicates.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_part_duplicated',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Support contract for slot "${slot.slotId}" assigns one part to multiple semantic regions.`,
      'disjoint root, sole, toe, and claw part ownership',
      duplicates
    ), true);
  }
  const uniquePartIds = [...new Set(referencedPartIds)];
  const missingPartIds = uniquePartIds
    .filter((partId) => !context.parts.has(partId))
    .sort(compareStableText);
  if (missingPartIds.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_part_missing',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Support contract for slot "${slot.slotId}" is not fully materialized.`,
      'compile every declared support-region part before delivery',
      missingPartIds
    ), false);
  }
  return {
    referencedPartIds: uniquePartIds.sort(compareStableText),
    missingPartIds,
    valid:
      unowned.length === 0 &&
      duplicates.length === 0 &&
      missingPartIds.length === 0,
    issues: evaluation.issues,
    violations: evaluation.violations
  };
};
