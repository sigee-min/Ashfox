import {
  hasExactContractKeys,
  isClosedContractRecord
} from '@ashfox/internal-contracts';

import {
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../evidence';
import {
  EYE_COMPONENT_KEYS,
  EYE_PALETTE_SET,
  PAIRED_EYE_CONFIGURATION_KEYS,
  SINGLE_EYE_CONFIGURATION_KEYS
} from './contract';
import { validateFaceComponentSlots } from './topology';
import { AUTHORING_PART_ID_PATTERN } from '../primitives';
import {
  AUTHORING_EYE_CONFIGURATIONS,
  AUTHORING_EYE_PALETTES,
  type AuthoringEyeConfiguration,
  type AuthoringEyeFaceComponentDeclaration,
  type AuthoringSlotAssignment
} from '../../contract';

const EYE_CONFIGURATION_SET = new Set<string>(AUTHORING_EYE_CONFIGURATIONS);

const readEyeConfiguration = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): AuthoringEyeConfiguration | null => {
  if (!isClosedContractRecord(value) ||
    typeof value.kind !== 'string' ||
    !EYE_CONFIGURATION_SET.has(value.kind)) {
    addAuthoringProfileIssue(
      issues,
      path,
      'Eye configuration must be an explicit single or paired target contract.',
      '{kind:"single",slotId} | {kind:"paired",leftSlotId,rightSlotId}'
    );
    return null;
  }
  if (value.kind === 'single') {
    if (!hasExactContractKeys(value, SINGLE_EYE_CONFIGURATION_KEYS) ||
      typeof value.slotId !== 'string' ||
      !AUTHORING_PART_ID_PATTERN.test(value.slotId)) {
      addAuthoringProfileIssue(
        issues,
        path,
        'Single-eye configuration requires one canonical centered slot.',
        '{kind:"single",slotId}'
      );
      return null;
    }
    return { kind: 'single', slotId: value.slotId };
  }
  if (!hasExactContractKeys(value, PAIRED_EYE_CONFIGURATION_KEYS) ||
    typeof value.leftSlotId !== 'string' ||
    typeof value.rightSlotId !== 'string' ||
    !AUTHORING_PART_ID_PATTERN.test(value.leftSlotId) ||
    !AUTHORING_PART_ID_PATTERN.test(value.rightSlotId) ||
    value.leftSlotId === value.rightSlotId) {
    addAuthoringProfileIssue(
      issues,
      path,
      'Paired-eye configuration requires distinct canonical left/right slots.',
      '{kind:"paired",leftSlotId,rightSlotId}'
    );
    return null;
  }
  return {
    kind: 'paired',
    leftSlotId: value.leftSlotId,
    rightSlotId: value.rightSlotId
  };
};

export const readAuthoringEyeComponent = (
  entry: Readonly<Record<string, unknown>>,
  path: string,
  materialIds: readonly string[],
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): AuthoringEyeFaceComponentDeclaration | null => {
  if (!hasExactContractKeys(entry, EYE_COMPONENT_KEYS) || entry.form !== 'eye') {
    addAuthoringProfileIssue(
      issues,
      path,
      'Eye component must use the closed gaze and palette contract.',
      '{component:"eye",form:"eye",configuration,gaze,palette,materialIds}'
    );
    return null;
  }
  const configuration = readEyeConfiguration(
    entry.configuration,
    `${path}.configuration`,
    issues
  );
  const gazeValid = entry.gaze === 'centered';
  const paletteValid = typeof entry.palette === 'string' &&
    EYE_PALETTE_SET.has(entry.palette);
  const materialPolicyValid = materialIds.length === 1;
  if (!gazeValid) {
    addAuthoringProfileIssue(
      issues,
      `${path}.gaze`,
      'Eye gaze must use the compiler-derived centered contract.',
      'centered'
    );
  }
  if (!paletteValid) {
    addAuthoringProfileIssue(
      issues,
      `${path}.palette`,
      'Eye palette must use a compiler-owned contrast policy.',
      AUTHORING_EYE_PALETTES.join(' | ')
    );
  }
  if (!materialPolicyValid) {
    addAuthoringProfileIssue(
      issues,
      `${path}.materialIds`,
      'Eye contrast policy requires one shared iris material.',
      'exactly one material ID used by every configured eye member'
    );
  }
  if (!configuration) return null;
  const slotIds = configuration.kind === 'single'
    ? [configuration.slotId]
    : [configuration.leftSlotId, configuration.rightSlotId];
  const slotsValid = validateFaceComponentSlots(
    slotIds,
    `${path}.configuration`,
    hostSlotId,
    slotsById,
    issues
  );
  if (configuration.kind === 'single') {
    const slot = slotsById.get(configuration.slotId);
    if (slot && slot.symmetry.kind === 'paired') {
      addAuthoringProfileIssue(
        issues,
        `${path}.configuration.slotId`,
        'A single eye cannot be owned by one side of a slot pair.',
        'centered slot for bilateral projects, or asymmetric slot'
      );
      return null;
    }
  } else {
    const left = slotsById.get(configuration.leftSlotId);
    const right = slotsById.get(configuration.rightSlotId);
    const pairValid = left?.symmetry.kind === 'paired' &&
      right?.symmetry.kind === 'paired' &&
      left.symmetry.pairId === right.symmetry.pairId &&
      left.spatialRelations.includes('left') &&
      right.spatialRelations.includes('right');
    if (!pairValid) {
      addAuthoringProfileIssue(
        issues,
        `${path}.configuration`,
        'Paired eyes must target the left/right members of one declared slot pair.',
        'two paired slots sharing pairId with complementary left/right relations'
      );
      return null;
    }
  }
  if (!gazeValid || !paletteValid || !materialPolicyValid || !slotsValid) {
    return null;
  }
  return {
    component: 'eye',
    form: 'eye',
    configuration,
    gaze: 'centered',
    palette: entry.palette as (typeof AUTHORING_EYE_PALETTES)[number],
    materialIds
  };
};
