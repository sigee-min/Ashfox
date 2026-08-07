import type {
  AuthoringPlanEvaluation,
  AuthoringProfile
} from '@ashfox/engine-core';

const AUTHORING_PLAN_ISSUE_LIMIT = 20;
const INTENT_COVERAGE_FEATURE_LIMIT = 12;

export const authoringProfileProjection = (
  profile: AuthoringProfile | null
) => profile === null
  ? null
  : {
      schemaVersion: profile.schemaVersion,
      archetype: profile.archetype,
      track: profile.track,
      faceMode: profile.faceMode,
      face: profile.face === null
        ? null
        : {
            hostSlotId: profile.face.hostSlotId,
            mouthState: profile.face.mouthState,
            components: profile.face.components.map((component) => ({
              component: component.component,
              form: component.form,
              configuration: component.configuration
            })),
            exceptionCount: profile.face.exceptions.length
          },
      specialists: profile.specialists,
      structuralModuleCount: profile.slots.length,
      coverageCount: profile.coverage.length,
      attachmentBindingCount: profile.bindings.filter(
        (binding) => binding.type === 'attachment'
      ).length,
      motionBindings: profile.bindings.flatMap((binding) =>
        binding.type === 'motion'
          ? [{
              specialist: binding.specialist,
              clipId: binding.clipId,
              role: binding.role
            }]
          : []
      )
    };

export const authoringPlanProjection = (
  plan: AuthoringPlanEvaluation
) => {
  const prioritizedCoverageFeatures = plan.intentCoverage === null
    ? []
    : [...plan.intentCoverage.features].sort((left, right) =>
        Number(left.state === 'complete') -
          Number(right.state === 'complete') ||
        left.featureRef.localeCompare(right.featureRef)
      );
  const projectedCoverageFeatures = prioritizedCoverageFeatures
    .slice(0, INTENT_COVERAGE_FEATURE_LIMIT)
    .map((feature) => ({
      featureRef: feature.featureRef,
      state: feature.state,
      slotIds: feature.slotIds,
      materialIds: feature.materialIds,
      realizedAspects: feature.realizedAspects,
      ...(feature.missingSlotIds.length === 0
        ? {}
        : { missingSlotIds: feature.missingSlotIds }),
      ...(feature.missingMaterialIds.length === 0
        ? {}
        : { missingMaterialIds: feature.missingMaterialIds })
    }));
  return {
    selected: plan.selected,
    profileValid: plan.profileValid,
    routingAligned: plan.routingAligned,
    ready: plan.ready,
    structuralQuality: plan.structuralQuality === null
      ? null
      : {
          activeStage: plan.structuralQuality.activeStage,
          ready: plan.structuralQuality.ready,
          gates: plan.structuralQuality.gates.map((gate) => ({
            stage: gate.stage,
            state: gate.state,
            structuralRoles: gate.structuralRoles,
            incompleteSlotIds: gate.incompleteSlotIds
          }))
        },
    intentCoverage: plan.intentCoverage === null
      ? null
      : {
          track: plan.intentCoverage.track,
          ready: plan.intentCoverage.ready,
          featureCount: plan.intentCoverage.features.length,
          incompleteFeatureCount: plan.intentCoverage.features.filter(
            (feature) => feature.state === 'incomplete'
          ).length,
          features: projectedCoverageFeatures,
          truncatedFeatureCount:
            plan.intentCoverage.features.length -
            projectedCoverageFeatures.length,
          stages: plan.intentCoverage.stages.map((stage) => ({
            stage: stage.stage,
            ready: stage.ready,
            slotCount: stage.slotIds.length,
            completeSlotCount: stage.completeSlotIds.length
          }))
        },
    faceQuality: plan.faceQuality === null
      ? null
      : {
          mode: plan.faceQuality.mode,
          hostSlotId: plan.faceQuality.hostSlotId,
          mouthState: plan.faceQuality.mouthState,
          hostReady: plan.faceQuality.hostReady,
          ready: plan.faceQuality.ready,
          incompleteComponentCount: plan.faceQuality.components.filter(
            (component) => component.state === 'incomplete'
          ).length,
          components: plan.faceQuality.components.map((component) => ({
            component: component.component,
            form: component.form,
            state: component.state,
            slotIds: component.slotIds,
            materialIds: component.materialIds,
            ...(component.readableEyePartIds.length === 0
              ? {}
              : { readableEyePartIds: component.readableEyePartIds }),
            ...(component.missingSlotIds.length === 0
              ? {}
              : { missingSlotIds: component.missingSlotIds }),
            ...(component.missingMaterialIds.length === 0
              ? {}
              : { missingMaterialIds: component.missingMaterialIds })
          })),
          exceptions: plan.faceQuality.exceptions
        },
    slots: plan.slots.map((slot) => ({
      slotId: slot.slotId,
      authority: slot.authority,
      authorityType: slot.authorityType,
      structuralRole: slot.structuralRole,
      qualityStage: slot.qualityStage,
      parentSlotIds: slot.parentSlotIds,
      spatialRelations: slot.spatialRelations,
      facing: slot.facing,
      pairId: slot.pairId,
      contact: slot.contact,
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
  };
};
