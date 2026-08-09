import type { ProjectDocument } from '../../model';
import { readPartRecipe } from '../../modeling/recipe';
import { evaluateAssetQuality } from '../quality/asset';
import { evaluateAuthoringCompatibility } from '../compatibility';
import { authoringPlanIssue } from '../quality/issues';
import { authoringRoutingMatches } from '../profile/routing';
import { readAuthoringProfile } from '../profile';
import {
  EMPTY_AUTHORING_COMPATIBILITY,
  type AuthoringPlanEvaluation
} from './evaluation/contract';
import { collectAuthoringPlanIssues } from './issues';
import { evaluateAuthoringSlots } from './slots';

export type { AuthoringPlanEvaluation } from './evaluation/contract';
export type {
  AuthoringPlanIssueCode,
  AuthoringPlanIssue,
  AuthoringSlotState,
  AuthoringSlotStatus
} from './contract';
export { composeAuthoringSlots } from './slots';

const invalidProfileEvaluation = (
  message: string,
  expected: string
): AuthoringPlanEvaluation => ({
  selected: true,
  profile: null,
  profileValid: false,
  routingAligned: false,
  compatibility: EMPTY_AUTHORING_COMPATIBILITY,
  slots: [],
  assetQuality: null,
  incompleteSlotIds: [],
  unassignedPartIds: [],
  issues: [authoringPlanIssue(
    'authoring.plan.profile_invalid',
    'authoringProfile',
    message,
    expected
  )],
  ready: false
});

const missingProfileEvaluation = (): AuthoringPlanEvaluation => ({
  selected: false,
  profile: null,
  profileValid: true,
  routingAligned: false,
  compatibility: EMPTY_AUTHORING_COMPATIBILITY,
  slots: [],
  assetQuality: null,
  incompleteSlotIds: [],
  unassignedPartIds: [],
  issues: [authoringPlanIssue(
    'authoring.plan.profile_missing',
    'authoringProfile',
    'No canonical authoring authority profile is selected.',
    'compile one authoritative Intent Program before generated model work'
  )],
  ready: false
});

/**
 * Public authoring evaluator. Profile reading, slot evaluation, asset quality,
 * and diagnostic ordering are independent immutable stages.
 */
export const evaluateAuthoringPlan = (
  document: ProjectDocument
): AuthoringPlanEvaluation => {
  const read = readAuthoringProfile(document);
  if (!read.ok) {
    return invalidProfileEvaluation(
      read.issues[0]?.message ?? 'Authoring profile is invalid.',
      read.issues[0]?.expected ?? 'a canonical authoring profile'
    );
  }
  if (!read.profile || !document.intent) return missingProfileEvaluation();

  const profile = read.profile;
  const compatibility = evaluateAuthoringCompatibility(profile);
  const routingAligned = authoringRoutingMatches(document, profile.routing);
  const recipe = readPartRecipe(document);
  const hasRecipe = recipe.ok && recipe.recipe !== null;
  const parts = hasRecipe ? recipe.recipe?.parts ?? [] : [];
  const materials = hasRecipe ? recipe.recipe?.materials ?? [] : [];
  const slotEvaluation = evaluateAuthoringSlots(
    profile,
    parts,
    document.intent,
    hasRecipe
  );
  const assetQuality = evaluateAssetQuality(
    document,
    document.intent,
    profile,
    slotEvaluation.slots,
    parts,
    materials
  );
  const issues = collectAuthoringPlanIssues({
    document,
    profile,
    routingAligned,
    compatibility,
    slots: slotEvaluation.slots,
    assetQuality,
    unassignedPartIds: slotEvaluation.unassignedPartIds
  });
  const incompleteSlotIds = slotEvaluation.slots
    .filter((slot) => slot.state !== 'complete')
    .map((slot) => slot.slotId);
  return {
    selected: true,
    profile,
    profileValid: true,
    routingAligned,
    compatibility,
    slots: slotEvaluation.slots,
    assetQuality,
    incompleteSlotIds,
    unassignedPartIds: slotEvaluation.unassignedPartIds,
    issues,
    ready: routingAligned && compatibility.compatible &&
      assetQuality.ready && hasRecipe && issues.length === 0
  };
};
