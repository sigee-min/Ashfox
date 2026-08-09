import type { ProjectDocument } from '../../model';
import type { AssetQualityEvaluation } from '../quality/asset';
import { authoringPlanIssue } from '../quality/issues';
import { motionIssues } from './motion';
import type {
  AuthoringCompatibilityResult,
  AuthoringProfile
} from '../contract';
import type { AuthoringPlanIssue, AuthoringSlotStatus } from './contract';

export interface AuthoringPlanIssueInput {
  readonly document: ProjectDocument;
  readonly profile: AuthoringProfile;
  readonly routingAligned: boolean;
  readonly compatibility: AuthoringCompatibilityResult;
  readonly slots: readonly AuthoringSlotStatus[];
  readonly assetQuality: AssetQualityEvaluation;
  readonly unassignedPartIds: readonly string[];
}

const slotIssues = (slot: AuthoringSlotStatus): readonly AuthoringPlanIssue[] => {
  const issues: AuthoringPlanIssue[] = [];
  const path = slot.authorityType === 'archetype'
    ? `authoringProfile.slots.${slot.slotId}`
    : `authoringProfile.bindings.${slot.slotId}`;
  if (slot.state === 'planned' || slot.state === 'missing') {
    issues.push(authoringPlanIssue(
      slot.authorityType === 'specialist'
        ? 'authoring.plan.attachment_incomplete'
        : 'authoring.plan.slot_incomplete',
      path,
      `Authoring slot "${slot.slotId}" is not materialized.`,
      slot.instruction,
      {
        authority: slot.authority,
        partIds: slot.missingPartIds.length > 0
          ? slot.missingPartIds : slot.partIds
      }
    ));
  }
  for (const [code, partIds] of [
    ['authoring.plan.slot_kind_invalid', slot.invalidKindPartIds],
    ['authoring.plan.slot_hierarchy_invalid', slot.invalidHierarchyPartIds],
    ['authoring.plan.slot_spatial_invalid', slot.invalidSpatialPartIds],
    ['authoring.plan.slot_facing_invalid', slot.invalidFacingPartIds]
  ] as const) {
    if (partIds.length === 0) continue;
    issues.push(authoringPlanIssue(
      code,
      path,
      `Authoring slot "${slot.slotId}" violates ${code.slice('authoring.plan.slot_'.length).replace('_invalid', '')} constraints.`,
      slot.instruction,
      { authority: slot.authority, partIds }
    ));
  }
  return issues;
};

/** Owns the canonical diagnostic ordering for authoring-plan evaluation. */
export const collectAuthoringPlanIssues = (
  input: AuthoringPlanIssueInput
): readonly AuthoringPlanIssue[] => {
  const issues: AuthoringPlanIssue[] = [];
  if (!input.routingAligned) {
    issues.push(authoringPlanIssue(
      'authoring.plan.routing_stale',
      'authoringProfile.routing',
      'Authoring authority routing no longer matches intent or references.',
      'recompile the authoritative Intent Program source'
    ));
  }
  if (!input.compatibility.compatible) {
    issues.push(...input.compatibility.issues.map((finding) => authoringPlanIssue(
      'authoring.plan.compatibility_failed',
      `authoringProfile.${finding.path}`,
      finding.message,
      finding.expected,
      finding.authority ? { authority: finding.authority } : {}
    )));
  }
  for (const slot of input.slots) issues.push(...slotIssues(slot));
  issues.push(...input.assetQuality.structuralQuality.issues);
  issues.push(...input.assetQuality.symmetryQuality.issues);
  issues.push(...input.assetQuality.supportQuality.issues);
  issues.push(...input.assetQuality.spanQuality.issues);
  issues.push(...input.assetQuality.restPoseQuality.issues);
  issues.push(...input.assetQuality.intentCoverage.issues);
  issues.push(...input.assetQuality.faceQuality.issues);
  if (input.unassignedPartIds.length > 0) {
    issues.push(authoringPlanIssue(
      'authoring.plan.part_unassigned',
      'modeling.parts',
      `Model contains part IDs outside the authority plan: ${input.unassignedPartIds.join(', ')}.`,
      'every generated part owned by one archetype slot or attachment binding',
      { partIds: input.unassignedPartIds }
    ));
  }
  issues.push(...motionIssues(input.document, input.profile));
  return issues;
};
