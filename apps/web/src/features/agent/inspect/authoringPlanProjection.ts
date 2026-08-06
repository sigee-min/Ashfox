import type {
  AuthoringPlanEvaluation,
  AuthoringProfile
} from '@ashfox/engine-core';

const AUTHORING_PLAN_ISSUE_LIMIT = 20;

export const authoringProfileProjection = (
  profile: AuthoringProfile | null
) => profile === null
  ? null
  : {
      schemaVersion: profile.schemaVersion,
      archetype: profile.archetype,
      specialists: profile.specialists,
      routing: profile.routing,
      slots: profile.slots,
      bindings: profile.bindings
    };

export const authoringPlanProjection = (
  plan: AuthoringPlanEvaluation
) => ({
  selected: plan.selected,
  profileValid: plan.profileValid,
  routingAligned: plan.routingAligned,
  ready: plan.ready,
  slots: plan.slots.map((slot) => ({
    slotId: slot.slotId,
    authority: slot.authority,
    authorityType: slot.authorityType,
    required: slot.required,
    state: slot.state,
    ...(slot.partIds.length === 0 ? {} : { partIds: slot.partIds }),
    ...(slot.missingPartIds.length === 0
      ? {}
      : { missingPartIds: slot.missingPartIds }),
    ...(slot.invalidKindPartIds.length === 0
      ? {}
      : { invalidKindPartIds: slot.invalidKindPartIds }),
    ...(slot.invalidHierarchyPartIds.length === 0
      ? {}
      : { invalidHierarchyPartIds: slot.invalidHierarchyPartIds }),
    ...(slot.invalidSpatialPartIds.length === 0
      ? {}
      : { invalidSpatialPartIds: slot.invalidSpatialPartIds }),
    ...(slot.invalidFacingPartIds.length === 0
      ? {}
      : { invalidFacingPartIds: slot.invalidFacingPartIds }),
    ...(slot.attachmentPortId === null
      ? {}
      : { attachmentPortId: slot.attachmentPortId }),
    ...(slot.hostSlotId === null
      ? {}
      : { hostSlotId: slot.hostSlotId })
  })),
  incompleteSlotIds: plan.incompleteSlotIds,
  unassignedPartIds: plan.unassignedPartIds,
  issues: plan.issues.slice(0, AUTHORING_PLAN_ISSUE_LIMIT),
  issueCount: plan.issues.length,
  issuesTruncated: plan.issues.length > AUTHORING_PLAN_ISSUE_LIMIT
});
