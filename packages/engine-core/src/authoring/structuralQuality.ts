import {
  AUTHORING_QUALITY_STAGES,
  type AuthoringQualityStage,
  type AuthoringStructuralRole
} from './authoringTypes';
import type {
  AuthoringPlanIssue,
  AuthoringSlotStatus
} from './authoringPlanTypes';
import { uniqueSortedAuthoringValues } from './authoringCollections';
import { authoringPlanIssue } from './authoringIssueFactories';

export const STRUCTURAL_QUALITY_STAGE_ORDER = AUTHORING_QUALITY_STAGES;

export type StructuralQualityGateState =
  | 'passed'
  | 'incomplete'
  | 'locked'
  | 'violated';

export interface StructuralQualityGate {
  stage: AuthoringQualityStage;
  state: StructuralQualityGateState;
  requiredSlotIds: readonly string[];
  incompleteSlotIds: readonly string[];
  materializedSlotIds: readonly string[];
  structuralRoles: readonly AuthoringStructuralRole[];
}

export interface StructuralQualityEvaluation {
  gates: readonly StructuralQualityGate[];
  activeStage: AuthoringQualityStage | 'complete';
  issues: readonly AuthoringPlanIssue[];
  ready: boolean;
}

/**
 * Enforces macro-to-focal authoring without using cuboid counts as a quality
 * score. Required structural landmarks make a gate pass; materializing a
 * later-stage slot before all earlier required landmarks are complete is a
 * contract violation.
 */
export const evaluateStructuralQuality = (
  slots: readonly AuthoringSlotStatus[]
): StructuralQualityEvaluation => {
  const gates: StructuralQualityGate[] = [];
  const issues: AuthoringPlanIssue[] = [];
  let priorStagesPassed = true;

  for (const [stageIndex, stage] of STRUCTURAL_QUALITY_STAGE_ORDER.entries()) {
    const stageSlots = slots.filter((slot) => slot.qualityStage === stage);
    const requiredSlots = stageSlots.filter((slot) => slot.required);
    const incompleteSlots = requiredSlots.filter(
      (slot) => slot.state !== 'complete'
    );
    const materializedSlots = stageSlots.filter(
      (slot) => slot.presentPartIds.length > 0
    );
    const prematurelyMaterialized: boolean = !priorStagesPassed &&
      materializedSlots.length > 0;
    const state: StructuralQualityGateState = prematurelyMaterialized
      ? 'violated'
      : !priorStagesPassed
        ? 'locked'
        : incompleteSlots.length > 0
          ? 'incomplete'
          : 'passed';

    gates.push({
      stage,
      state,
      requiredSlotIds: requiredSlots.map((slot) => slot.slotId),
      incompleteSlotIds: incompleteSlots.map((slot) => slot.slotId),
      materializedSlotIds: materializedSlots.map((slot) => slot.slotId),
      structuralRoles: uniqueSortedAuthoringValues(
        stageSlots.flatMap((slot) =>
          slot.structuralRole === null ? [] : [slot.structuralRole]
        )
      )
    });

    if (prematurelyMaterialized) {
      const blockedBy = gates
        .slice(0, stageIndex)
        .flatMap((gate) => gate.incompleteSlotIds);
      for (const slot of materializedSlots) {
        issues.push(authoringPlanIssue(
          'authoring.plan.quality_stage_invalid',
          slot.authorityType === 'archetype'
            ? `authoringProfile.slots.${slot.slotId}`
            : `authoringProfile.bindings.${slot.slotId}`,
          `Authoring slot "${slot.slotId}" materializes the ${stage} ` +
            'stage before earlier structural landmarks are complete.',
          blockedBy.length > 0
            ? `complete earlier slots first: ${blockedBy.join(', ')}`
            : 'complete earlier structural quality gates first',
          { authority: slot.authority, partIds: slot.presentPartIds }
        ));
      }
    }

    priorStagesPassed = priorStagesPassed && state === 'passed';
  }

  const firstOpen = gates.find((gate) => gate.state !== 'passed');
  return {
    gates,
    activeStage: firstOpen?.stage ?? 'complete',
    issues,
    ready: gates.every((gate) => gate.state === 'passed')
  };
};
