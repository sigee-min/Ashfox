import {
  hasExactContractKeys,
  isClosedContractRecord
} from '@ashfox/internal-contracts';

import type { ProjectIntent } from '../model';
import {
  AUTHORING_REST_POSE_MODES,
  type AuthoringRestPose,
  type AuthoringRestPoseMode,
  type AuthoringSlotAssignment
} from './authoringTypes';
import {
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';

const REST_POSE_KEYS = new Set(['kind', 'mode']);
const REST_POSE_MODES = new Set<string>(AUTHORING_REST_POSE_MODES);

const groundedSupportSlots = (
  slots: readonly AuthoringSlotAssignment[],
  kind: 'base' | 'foot' | 'wheel'
): readonly AuthoringSlotAssignment[] => slots.filter(
  (slot) => slot.support.kind === kind && slot.support.contact === 'grounded'
);

const supportSlots = (
  slots: readonly AuthoringSlotAssignment[],
  kind: 'base' | 'foot' | 'wheel'
): readonly AuthoringSlotAssignment[] => slots.filter(
  (slot) => slot.support.kind === kind
);

export const deriveAuthoringRestPoseMode = (
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[]
): AuthoringRestPoseMode | null => {
  const groundedFeet = groundedSupportSlots(slots, 'foot');
  const groundedBases = groundedSupportSlots(slots, 'base');
  const groundedWheels = groundedSupportSlots(slots, 'wheel');
  const allFeet = supportSlots(slots, 'foot');
  const allBases = supportSlots(slots, 'base');
  const allWheels = supportSlots(slots, 'wheel');
  switch (intent.semanticContract.canonicalSupport.kind) {
    case 'standing-feet':
      return allFeet.length > 0 &&
        groundedFeet.length === allFeet.length &&
        allBases.length === 0 && allWheels.length === 0
        ? 'standing'
        : null;
    case 'rolling-wheels':
      return allWheels.length > 0 &&
        groundedWheels.length === allWheels.length &&
        allFeet.length === 0 && allBases.length === 0
        ? 'rolling'
        : null;
    case 'supported-base':
      return allBases.length > 0 &&
        groundedBases.length === allBases.length &&
        allFeet.length === 0 && allWheels.length === 0
        ? 'supported'
        : null;
    case 'airborne':
      return groundedFeet.length === 0 && groundedBases.length === 0 &&
        groundedWheels.length === 0
        ? 'airborne'
        : null;
    case 'free-explicit':
      return groundedFeet.length === 0 && groundedBases.length === 0 &&
        groundedWheels.length === 0
        ? 'free'
        : null;
  }
};

export const readAuthoringRestPose = (
  value: unknown,
  intent: ProjectIntent | undefined,
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): AuthoringRestPose | null => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, REST_POSE_KEYS) ||
    value.kind !== 'canonical-neutral' ||
    typeof value.mode !== 'string' ||
    !REST_POSE_MODES.has(value.mode)
  ) {
    addIssue(
      issues,
      'restPose',
      'Rest pose must use the closed canonical-neutral contract.',
      '{kind:"canonical-neutral",mode:standing|rolling|supported|airborne|free}'
    );
    return null;
  }
  const mode = value.mode as AuthoringRestPoseMode;
  if (!intent) return { kind: 'canonical-neutral', mode };
  const derived = deriveAuthoringRestPoseMode(intent, slots);
  if (!derived) {
    addIssue(
      issues,
      'restPose.mode',
      'Project grounding and typed supports do not determine one canonical neutral rest mode.',
      'grounded feet only for standing, grounded wheels only for rolling, grounded bases only for supported, and no grounded support for airborne or free'
    );
    return null;
  }
  if (mode !== derived) {
    addIssue(
      issues,
      'restPose.mode',
      `Rest pose mode "${mode}" contradicts the derived "${derived}" mode.`,
      derived
    );
    return null;
  }
  return { kind: 'canonical-neutral', mode };
};
