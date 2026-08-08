import type {
  AuthoringPlanEvaluation,
  AuthoringProfile
} from '@ashfox/engine-core';

const AUTHORING_PLAN_ISSUE_LIMIT = 8;
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
            components: profile.face.components.map((component) =>
              component.component === 'eye'
                ? {
                    component: component.component,
                    form: component.form,
                    configuration: component.configuration,
                    gaze: component.gaze,
                    palette: component.palette
                  }
                : {
                    component: component.component,
                    form: component.form,
                    slotIds: component.slotIds
                  }
            ),
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
  const quality = plan.assetQuality;
  const prioritizedCoverageFeatures = quality === null
    ? []
    : [...quality.intentCoverage.features].sort((left, right) =>
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
    assetQuality: quality === null
      ? null
      : {
          track: quality.track,
          activeStage: quality.activeStage,
          ready: quality.ready,
          dimensions: quality.dimensions,
          structuralQuality: {
            activeStage: quality.structuralQuality.activeStage,
            ready: quality.structuralQuality.ready,
            gates: quality.structuralQuality.gates.map((gate) => ({
              stage: gate.stage,
              state: gate.state,
              structuralRoles: gate.structuralRoles,
              incompleteSlotIds: gate.incompleteSlotIds
            }))
          },
          symmetryQuality: {
            required: quality.symmetryQuality.required,
            ready: quality.symmetryQuality.ready,
            statusCount: quality.symmetryQuality.statuses.length,
            failingStatuses: quality.symmetryQuality.statuses
              .filter((status) =>
                !status.complete ||
                !status.geometryExact ||
                !status.featureExact ||
                !status.lateralOwnershipExact ||
                !status.rigExact
              )
              .map((status) => ({
                id: status.id,
                slotIds: status.slotIds,
                complete: status.complete,
                geometryExact: status.geometryExact,
                featureExact: status.featureExact,
                lateralOwnershipExact: status.lateralOwnershipExact,
                rigExact: status.rigExact
              }))
          },
          supportQuality: {
            ready: quality.supportQuality.ready,
            statusCount: quality.supportQuality.statuses.filter(
              (status) => status.supportKind !== 'none'
            ).length,
            failingStatuses: quality.supportQuality.statuses.flatMap(
              (status) =>
                status.supportKind === 'none' || status.state === 'complete'
                  ? []
                  : [{
                    slotId: status.slotId,
                    supportKind: status.supportKind,
                    contact: status.contact,
                    state: status.state,
                    missingPartIds: status.missingPartIds,
                    groundContactCellCount:
                      status.groundContactCellCount,
                    downwardExposedSoleCellCount:
                      status.downwardExposedSoleCellCount,
                    toeForwardMarginCells:
                      status.toeForwardMarginCells,
                    clawForwardMarginCells:
                      status.clawForwardMarginCells,
                    issueCodes: status.issueCodes
                  }]
            )
          },
          intentCoverage: {
            ready: quality.intentCoverage.ready,
            featureCount: quality.intentCoverage.features.length,
            incompleteFeatureCount: quality.intentCoverage.features.filter(
              (feature) => feature.state === 'incomplete'
            ).length,
            features: projectedCoverageFeatures,
            truncatedFeatureCount:
              quality.intentCoverage.features.length -
              projectedCoverageFeatures.length,
            stages: quality.intentCoverage.stages.map((stage) => ({
              stage: stage.stage,
              ready: stage.ready,
              slotCount: stage.slotIds.length,
              completeSlotCount: stage.completeSlotIds.length
            }))
          },
          faceQuality: {
            mode: quality.faceQuality.mode,
            hostSlotId: quality.faceQuality.hostSlotId,
            mouthState: quality.faceQuality.mouthState,
            hostReady: quality.faceQuality.hostReady,
            ready: quality.faceQuality.ready,
            incompleteComponentCount: quality.faceQuality.components.filter(
              (component) => component.state === 'incomplete'
            ).length,
            components: quality.faceQuality.components.map((component) => ({
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
            exceptions: quality.faceQuality.exceptions
          }
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
      symmetry: slot.symmetry,
      support: slot.support,
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
