import type { ProjectIntent } from '../../model';
import type {
  PartMaterialDefinition,
  PartSpec
} from '../../modeling/part';
import type {
  AuthoringPlanIssue,
  AuthoringSlotStatus
} from '../plan/contract';
import { uniqueSortedAuthoringValues } from '../values';
import { authoringPlanIssue } from './issues';
import { authoringTrackPolicy } from '../profile/tracks';
import {
  AUTHORING_QUALITY_STAGES,
  type AuthoringProfile,
  type AuthoringQualityStage,
  type AuthoringTrack
} from '../contract';

export const AUTHORING_COVERAGE_ASPECTS = [
  'macro',
  'meso',
  'focal',
  'material'
] as const;
export type AuthoringCoverageAspect =
  (typeof AUTHORING_COVERAGE_ASPECTS)[number];

export interface IntentFeatureCoverageStatus {
  featureRef: string;
  feature: string;
  slotIds: readonly string[];
  completeSlotIds: readonly string[];
  missingSlotIds: readonly string[];
  materialIds: readonly string[];
  realizedMaterialIds: readonly string[];
  missingMaterialIds: readonly string[];
  realizedAspects: readonly AuthoringCoverageAspect[];
  state: 'complete' | 'incomplete';
}

export interface IntentCoverageStageStatus {
  stage: AuthoringQualityStage;
  slotIds: readonly string[];
  completeSlotIds: readonly string[];
  ready: boolean;
}

export interface IntentCoverageEvaluation {
  track: AuthoringTrack;
  features: readonly IntentFeatureCoverageStatus[];
  stages: readonly IntentCoverageStageStatus[];
  issues: readonly AuthoringPlanIssue[];
  ready: boolean;
}

const aspectForStage = (
  stage: AuthoringQualityStage
): Exclude<AuthoringCoverageAspect, 'material'> => {
  switch (stage) {
    case 'silhouette': return 'macro';
    case 'structure': return 'meso';
    case 'focal': return 'focal';
  }
};

export const evaluateIntentCoverage = (
  profile: AuthoringProfile,
  intent: ProjectIntent,
  slots: readonly AuthoringSlotStatus[],
  parts: readonly PartSpec[],
  materials: readonly PartMaterialDefinition[]
): IntentCoverageEvaluation => {
  const policy = authoringTrackPolicy(profile.track);
  const archetypeSlots = slots.filter(
    (slot) => slot.authorityType === 'archetype'
  );
  const slotsById = new Map(
    archetypeSlots.map((slot) => [slot.slotId, slot])
  );
  const explicitMaterialIds = new Set(
    materials.map((material) => material.id)
  );
  const issues: AuthoringPlanIssue[] = [];
  const features = profile.coverage.map((coverage) => {
    const featureIndex = Number(coverage.featureRef.split('.').at(-1));
    const feature = intent.features[featureIndex] ?? coverage.featureRef;
    const mappedSlots = coverage.slotIds.flatMap((slotId) => {
      const slot = slotsById.get(slotId);
      return slot ? [slot] : [];
    });
    const completeSlots = mappedSlots.filter(
      (slot) => slot.state === 'complete'
    );
    const completeSlotIds = completeSlots.map((slot) => slot.slotId);
    const missingSlotIds = coverage.slotIds.filter(
      (slotId) => !completeSlotIds.includes(slotId)
    );
    const eligiblePartIds = new Set(
      coverage.slotIds.length === 0
        ? parts.map((part) => part.partId)
        : completeSlots.flatMap((slot) => slot.partIds)
    );
    const realizedMaterialIds = coverage.materialIds.filter((materialId) =>
      explicitMaterialIds.has(materialId) &&
      parts.some((part) =>
        eligiblePartIds.has(part.partId) && part.materialId === materialId
      )
    );
    const missingMaterialIds = coverage.materialIds.filter(
      (materialId) => !realizedMaterialIds.includes(materialId)
    );
    const realizedAspects = uniqueSortedAuthoringValues<AuthoringCoverageAspect>([
      ...completeSlots.map((slot) => aspectForStage(slot.qualityStage)),
      ...(realizedMaterialIds.length > 0 ? ['material' as const] : [])
    ]);
    const hasRealization =
      completeSlotIds.length > 0 || realizedMaterialIds.length > 0;
    const state =
      hasRealization &&
      missingSlotIds.length === 0 &&
      missingMaterialIds.length === 0
        ? 'complete' as const
        : 'incomplete' as const;
    if (state === 'incomplete') {
      const missing = [
        ...missingSlotIds.map((slotId) => `slot:${slotId}`),
        ...missingMaterialIds.map((materialId) => `material:${materialId}`)
      ];
      issues.push(authoringPlanIssue(
        'authoring.plan.intent_coverage_incomplete',
        `authoringProfile.coverage.${coverage.featureRef}`,
        `Intent feature "${feature}" is not realized by its declared ` +
          'structural or explicit material targets.',
        missing.length > 0
          ? `materialize declared targets: ${missing.join(', ')}`
          : 'at least one complete slot or explicitly used modeling material',
        {
          authority: profile.archetype,
          partIds: uniqueSortedAuthoringValues(
            coverage.slotIds.flatMap((slotId) =>
              slotsById.get(slotId)?.partIds ?? []
            )
          )
        }
      ));
    }
    return {
      featureRef: coverage.featureRef,
      feature,
      slotIds: coverage.slotIds,
      completeSlotIds,
      missingSlotIds,
      materialIds: coverage.materialIds,
      realizedMaterialIds,
      missingMaterialIds,
      realizedAspects,
      state
    } satisfies IntentFeatureCoverageStatus;
  });
  const stages: IntentCoverageStageStatus[] = AUTHORING_QUALITY_STAGES.map((stage) => {
    const stageSlots = archetypeSlots.filter(
      (slot) => slot.qualityStage === stage
    );
    const completeSlotIds = stageSlots
      .filter((slot) => slot.state === 'complete')
      .map((slot) => slot.slotId);
    const required = policy.requiredQualityStages.includes(stage) ||
      stageSlots.length > 0;
    return {
      stage,
      slotIds: stageSlots.map((slot) => slot.slotId),
      completeSlotIds,
      ready:
        !required ||
        (stageSlots.length > 0 && completeSlotIds.length > 0)
    };
  });
  for (const stage of stages) {
    if (stage.ready) continue;
    issues.push(authoringPlanIssue(
      'authoring.plan.track_stage_incomplete',
      `authoringProfile.track.${stage.stage}`,
      `${policy.label} track ` +
        `has no complete ${stage.stage} realization.`,
      `at least one complete ${stage.stage} slot`,
      { authority: profile.archetype }
    ));
  }
  return {
    track: profile.track,
    features,
    stages,
    issues,
    ready:
      features.every((feature) => feature.state === 'complete') &&
      stages.every((stage) => stage.ready)
  };
};
