import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type AuthoringFaceContract,
  type AuthoringSelectionInput,
  type AuthoringSlotAssignment
} from '../../../authoring/contract';
import type { ProjectIntent } from '../../../model';
import type { IntentProgramIr } from '../../../project/program/types';
import { compareStableText } from '../../../stableOrder';
import { motionAuthoringSelection } from '../motion';

const slotIdsForFeature = (
  feature: string,
  slots: readonly AuthoringSlotAssignment[]
): readonly string[] => {
  const separator = feature.indexOf(':');
  const kind = feature.slice(0, separator);
  const id = feature.slice(separator + 1);
  return slots.filter((slot) => {
    if (kind === 'core') return slot.slotId === `slot.core.${id}`;
    if (kind === 'limb' || kind === 'wheel') {
      return slot.slotId.startsWith(`slot.${kind}.`) &&
        slot.slotId.endsWith(`.${id}`);
    }
    if (['wing', 'fin', 'sail', 'panel'].includes(kind)) {
      return slot.slotId.startsWith(`slot.surface.${id}.`);
    }
    if (kind === 'focal') return slot.slotId === `slot.focal.${id}`;
    return slot.slotId === `slot.${id}`;
  }).map((slot) => slot.slotId);
};

const collectCoverage = (
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[]
) => intent.features.map((feature, index) => ({
  featureRef: `intent.features.${index}`,
  slotIds: slotIdsForFeature(feature, slots),
  materialIds: []
}));

/** Projects lowered slots into the closed authoring-profile request. */
export const projectIntentProgramAuthoring = (
  program: IntentProgramIr,
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[],
  face: AuthoringFaceContract | null
): AuthoringSelectionInput => {
  const motion = motionAuthoringSelection();
  return {
    archetype: {
      id: 'archetype.composable-form',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    },
    track: program.track,
    restPose: {
      kind: 'canonical-neutral',
      mode: program.support.kind === 'feet' ? 'standing'
        : program.support.kind === 'base' ? 'supported'
          : program.support.kind === 'wheels' ? 'rolling'
            : 'none'
    },
    faceMode: face ? 'full' : 'none',
    face,
    specialists: motion.specialists,
    claims: [{
      authority: {
        id: 'archetype.composable-form',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      },
      criterionId: 'criterion.structure-graph',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale: `The authoritative Intent Program for ${intent.subject} explicitly declares its structural graph.`
    }, ...motion.claims],
    slots: [...slots].sort((left, right) =>
      compareStableText(left.slotId, right.slotId)
    ),
    coverage: collectCoverage(intent, slots),
    bindings: motion.bindings
  };
};
