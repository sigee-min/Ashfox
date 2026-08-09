import type { ProjectDocument } from '../../../model';
import { readCompiledParts } from '../../../modeling/invariants';
import { readPartRecipe } from '../../../modeling/recipe';
import { compareStableText } from '../../../stableOrder';
import type { AuthoringPlanIssue } from '../../plan/contract';
import type { AuthoringProfile } from '../../contract';
import { authoringPlanIssue } from '../issues';
import { evaluateGroundedBalance } from './balance';
import type { RestPoseQualityEvaluation } from './contract';
import { evaluateGroundContract } from './ground';
import {
  expectedSupportSlots,
  supportContactPartIds,
  supportContractIsConsistent
} from './geometry';
import { evaluateStandingHierarchy } from './hierarchy';
import { createRestPoseStatus, emptyRestPoseStatus } from './status';

export { CANONICAL_STANDING_EXTENSION_POLICY } from './geometry';
export type {
  RestPoseQualityEvaluation,
  RestPoseQualityState,
  RestPoseQualityStatus
} from './contract';

const unavailableEvaluation = (
  profile: AuthoringProfile,
  issue: AuthoringPlanIssue,
  state: 'incomplete' | 'invalid',
  violation: boolean
): RestPoseQualityEvaluation => ({
  status: emptyRestPoseStatus(profile.restPose.mode, state),
  issues: [issue],
  violations: violation ? [issue] : [],
  ready: false
});

export const evaluateRestPoseQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): RestPoseQualityEvaluation => {
  const recipe = readPartRecipe(document);
  if (!recipe.ok || !recipe.recipe) {
    const issue = authoringPlanIssue(
      recipe.ok
        ? 'authoring.plan.rest_pose_incomplete'
        : 'authoring.plan.rest_pose_evaluation_unavailable',
      recipe.ok ? 'modeling.parts' : recipe.issues[0]?.path ?? 'modeling',
      recipe.ok
        ? 'Canonical neutral rest pose is not materialized.'
        : recipe.issues[0]?.message ??
          'Canonical neutral rest pose cannot be evaluated.',
      'a complete valid PartRecipe authored in canonical neutral rest'
    );
    return unavailableEvaluation(
      profile,
      issue,
      recipe.ok ? 'incomplete' : 'invalid',
      !recipe.ok
    );
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    const issue = authoringPlanIssue(
      'authoring.plan.rest_pose_evaluation_unavailable',
      compiled.issues[0]?.path ?? 'scene.parts',
      compiled.issues[0]?.message ??
        'Canonical neutral rest pose cannot be evaluated from compiled geometry.',
      'valid compiler-owned canonical occupancy'
    );
    return unavailableEvaluation(profile, issue, 'invalid', true);
  }

  const coreSlot = profile.slots.find(
    (slot) => slot.parentSlotIds.length === 0 &&
      slot.structuralRole === 'core'
  );
  const supportSlots = expectedSupportSlots(profile);
  const supportIds = new Set(
    supportSlots.flatMap((slot) => supportContactPartIds(slot.support))
  );
  const allCells = new Set(
    [...compiled.parts.values()].flatMap((part) => [...part.occupancy.cells])
  );
  const presentIds = new Set(recipe.recipe.parts.map((part) => part.partId));
  const declaredIds = [
    ...profile.slots.flatMap((slot) => slot.partIds),
    ...profile.bindings.flatMap((binding) =>
      binding.type === 'attachment' ? binding.partIds : []
    )
  ];
  const missingIds = [...new Set(declaredIds)]
    .filter((partId) => !presentIds.has(partId))
    .sort(compareStableText);
  const missingIssue = missingIds.length === 0
    ? null
    : authoringPlanIssue(
        'authoring.plan.rest_pose_incomplete',
        'modeling.parts',
        'Canonical neutral rest pose is missing declared authority parts.',
        'materialize every declared part before canonical rest review',
        { partIds: missingIds }
      );
  const supportIssue = supportContractIsConsistent(profile)
    ? null
    : authoringPlanIssue(
        'authoring.plan.rest_pose_support_invalid',
        'authoringProfile.restPose',
        `Canonical ${profile.restPose.mode} mode contradicts typed support contact.`,
        'standing with every foot grounded, rolling with every wheel grounded, supported with every base grounded, or no grounded support for none/free-explicit'
      );
  const baseIssues = [missingIssue, supportIssue].filter(
    (issue) => issue !== null
  );
  const ground = evaluateGroundContract(profile, supportIds, compiled.parts);
  const standing = evaluateStandingHierarchy(
    profile,
    coreSlot,
    supportSlots,
    supportIds,
    presentIds,
    compiled.parts
  );
  const balance = evaluateGroundedBalance(
    profile,
    coreSlot,
    supportIds,
    presentIds,
    missingIds,
    allCells,
    compiled.parts
  );
  const issues = [
    ...baseIssues,
    ...ground.issues,
    ...standing.issues,
    ...balance.issues
  ];
  const violations = [
    ...(supportIssue ? [supportIssue] : []),
    ...ground.violations,
    ...standing.violations,
    ...balance.violations
  ];
  const status = createRestPoseStatus({
    mode: profile.restPose.mode,
    coreSlotId: coreSlot?.slotId ?? null,
    supportSlotIds: supportSlots.map((slot) => slot.slotId)
      .sort(compareStableText),
    groundContactPartIds: ground.value.groundContactPartIds,
    nonSupportGroundContactPartIds:
      ground.value.nonSupportGroundContactPartIds,
    invalidHierarchyPartIds: standing.value.invalidHierarchyPartIds,
    invalidDescentPartIds: standing.value.invalidDescentPartIds,
    coreAboveSupport: balance.value.coreAboveSupport,
    centerOfMassSupported: balance.value.centerOfMassSupported,
    missingPartIds: missingIds,
    issues,
    violations
  });
  return { status, issues, violations, ready: status.state === 'complete' };
};
