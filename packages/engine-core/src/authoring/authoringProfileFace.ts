import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import type { ProjectIntent } from '../model';
import { PART_CONTRACT_LIMITS } from '../modeling/partContract';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import {
  readAuthoringFaceExceptions
} from './authoringProfileFaceEvidence';
import {
  validateAuthoringFaceDeclarations
} from './authoringProfileFacePolicy';
import { AUTHORING_PART_ID_PATTERN } from './authoringProfilePrimitives';
import {
  AUTHORING_EYE_CONFIGURATIONS,
  AUTHORING_EYE_PALETTES,
  AUTHORING_FACE_COMPONENTS,
  AUTHORING_FACE_FORMS,
  AUTHORING_MOUTH_STATES,
  type AuthoringFaceComponent,
  type AuthoringFaceComponentDeclaration,
  type AuthoringFaceContract,
  type AuthoringFaceForm,
  type AuthoringFaceMode,
  type AuthoringEyeConfiguration,
  type AuthoringSlotAssignment,
  type AuthoringTrack
} from './authoringTypes';

const FACE_KEYS = new Set([
  'hostSlotId',
  'mouthState',
  'components',
  'exceptions'
]);
const EYE_COMPONENT_KEYS = new Set([
  'component',
  'form',
  'configuration',
  'gaze',
  'palette',
  'materialIds'
]);
const NON_EYE_COMPONENT_KEYS = new Set([
  'component',
  'form',
  'slotIds',
  'materialIds'
]);
const SINGLE_EYE_CONFIGURATION_KEYS = new Set(['kind', 'slotId']);
const PAIRED_EYE_CONFIGURATION_KEYS = new Set([
  'kind',
  'leftSlotId',
  'rightSlotId'
]);
const FACE_COMPONENTS = new Set<string>(AUTHORING_FACE_COMPONENTS);
const FACE_FORMS = new Set<string>(AUTHORING_FACE_FORMS);
const EYE_CONFIGURATIONS = new Set<string>(AUTHORING_EYE_CONFIGURATIONS);
const EYE_PALETTES = new Set<string>(AUTHORING_EYE_PALETTES);
const MOUTH_STATES = new Set<string>(AUTHORING_MOUTH_STATES);

const FACE_FORMS_BY_COMPONENT: Readonly<
  Record<AuthoringFaceComponent, readonly AuthoringFaceForm[]>
> = {
  eye: ['eye'],
  nasal: ['nose', 'muzzle', 'beak'],
  oral: ['mouth', 'jaw', 'beak'],
  'eye-frame': ['orbital', 'brow'],
  jaw: ['jaw'],
  'mouth-interior': ['mouth-interior']
};

const readTargetIds = (
  value: unknown,
  path: string,
  limit: number,
  issues: AuthoringProfileIssue[]
): readonly string[] | null => {
  if (
    !isUniqueContractTextArray(value) ||
    value.length === 0 ||
    value.length > limit ||
    value.some((id) =>
      id.length > PART_CONTRACT_LIMITS.maxIdLength ||
      !AUTHORING_PART_ID_PATTERN.test(id)
    )
  ) {
    addIssue(
      issues,
      path,
      'Full-face component targets must be non-empty unique canonical IDs.',
      `1-${limit} canonical IDs`
    );
    return null;
  }
  return [...value].sort((left, right) => left.localeCompare(right));
};

const slotDescendsFrom = (
  slotId: string,
  hostSlotId: string,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>
): boolean => {
  const pending = [...(slotsById.get(slotId)?.parentSlotIds ?? [])];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate || visited.has(candidate)) continue;
    if (candidate === hostSlotId) return true;
    visited.add(candidate);
    pending.push(...(slotsById.get(candidate)?.parentSlotIds ?? []));
  }
  return false;
};

const readEyeConfiguration = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): AuthoringEyeConfiguration | null => {
  if (!isClosedContractRecord(value) ||
    typeof value.kind !== 'string' ||
    !EYE_CONFIGURATIONS.has(value.kind)) {
    addIssue(
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
      addIssue(
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
    addIssue(
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

const validateComponentSlots = (
  slotIds: readonly string[],
  path: string,
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): boolean => slotIds.every((slotId) => {
  if (!slotsById.has(slotId)) {
    addIssue(
      issues,
      path,
      `Face component references undeclared slot "${slotId}".`,
      'declared slots below the focal-frame host'
    );
    return false;
  }
  if (hostSlotId && !slotDescendsFrom(slotId, hostSlotId, slotsById)) {
    addIssue(
      issues,
      path,
      `Face component slot "${slotId}" is not below host "${hostSlotId}".`,
      'a descendant slot of the focal-frame host'
    );
    return false;
  }
  return true;
});

const readComponents = (
  value: unknown,
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): readonly AuthoringFaceComponentDeclaration[] => {
  if (
    !isDenseContractArray(value) ||
    value.length > AUTHORING_FACE_COMPONENTS.length
  ) {
    addIssue(
      issues,
      'face.components',
      'Full-face components must be a bounded dense array.',
      'closed semantic component declarations'
    );
    return [];
  }
  const components: AuthoringFaceComponentDeclaration[] = [];
  value.forEach((entry, index) => {
    const path = `face.components[${index}]`;
    if (!isClosedContractRecord(entry)) {
      addIssue(
        issues,
        path,
        'Face component must be a closed contract record.',
        'eye or non-eye component contract'
      );
      return;
    }
    const component = typeof entry.component === 'string' &&
      FACE_COMPONENTS.has(entry.component)
      ? entry.component as AuthoringFaceComponent
      : null;
    const form = typeof entry.form === 'string' && FACE_FORMS.has(entry.form)
      ? entry.form as AuthoringFaceForm
      : null;
    const semanticPair = component !== null && form !== null &&
      FACE_FORMS_BY_COMPONENT[component].includes(form);
    if (!semanticPair) {
      addIssue(
        issues,
        path,
        'Face component and form are not a valid semantic pair.',
        'eye; nasal nose/muzzle/beak; oral mouth/jaw/beak; eye-frame orbital/brow; jaw; or mouth-interior'
      );
    }
    const materialIds = readTargetIds(
      entry.materialIds,
      `${path}.materialIds`,
      AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
      issues
    );
    if (!component || !form || !semanticPair || !materialIds) return;
    if (component === 'eye') {
      if (!hasExactContractKeys(entry, EYE_COMPONENT_KEYS) || form !== 'eye') {
        addIssue(
          issues,
          path,
          'Eye component must use the closed gaze and palette contract.',
          '{component:"eye",form:"eye",configuration,gaze,palette,materialIds}'
        );
        return;
      }
      const configuration = readEyeConfiguration(
        entry.configuration,
        `${path}.configuration`,
        issues
      );
      const gazeValid = entry.gaze === 'centered';
      const paletteValid = typeof entry.palette === 'string' &&
        EYE_PALETTES.has(entry.palette);
      const materialPolicyValid = materialIds.length === 1;
      if (!gazeValid) {
        addIssue(
          issues,
          `${path}.gaze`,
          'Eye gaze must use the compiler-derived centered contract.',
          'centered'
        );
      }
      if (!paletteValid) {
        addIssue(
          issues,
          `${path}.palette`,
          'Eye palette must use a compiler-owned contrast policy.',
          AUTHORING_EYE_PALETTES.join(' | ')
        );
      }
      if (!materialPolicyValid) {
        addIssue(
          issues,
          `${path}.materialIds`,
          'Eye contrast policy requires one shared iris material.',
          'exactly one material ID used by every configured eye member'
        );
      }
      if (!configuration) return;
      const slotIds = configuration.kind === 'single'
        ? [configuration.slotId]
        : [configuration.leftSlotId, configuration.rightSlotId];
      const slotsValid = validateComponentSlots(
        slotIds,
        `${path}.configuration`,
        hostSlotId,
        slotsById,
        issues
      );
      if (configuration.kind === 'single') {
        const slot = slotsById.get(configuration.slotId);
        if (slot && slot.symmetry.kind === 'paired') {
          addIssue(
            issues,
            `${path}.configuration.slotId`,
            'A single eye cannot be owned by one side of a slot pair.',
            'centered slot for bilateral projects, or asymmetric slot'
          );
          return;
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
          addIssue(
            issues,
            `${path}.configuration`,
            'Paired eyes must target the left/right members of one declared slot pair.',
            'two paired slots sharing pairId with complementary left/right relations'
          );
          return;
        }
      }
      if (gazeValid && paletteValid && materialPolicyValid && slotsValid) {
        components.push({
          component: 'eye',
          form: 'eye',
          configuration,
          gaze: 'centered',
          palette: entry.palette as (typeof AUTHORING_EYE_PALETTES)[number],
          materialIds
        });
      }
      return;
    }
    if (!hasExactContractKeys(entry, NON_EYE_COMPONENT_KEYS)) {
      addIssue(
        issues,
        path,
        'Non-eye face component must use the closed slot contract.',
        '{component,form,slotIds,materialIds}'
      );
      return;
    }
    const slotIds = readTargetIds(
      entry.slotIds,
      `${path}.slotIds`,
      AUTHORING_PROFILE_LIMITS.maxSlots,
      issues
    );
    const slotsValid = slotIds !== null && validateComponentSlots(
      slotIds,
      `${path}.slotIds`,
      hostSlotId,
      slotsById,
      issues
    );
    if (slotIds && slotsValid) {
      components.push({
        component: component as Exclude<AuthoringFaceComponent, 'eye'>,
        form: form as Exclude<AuthoringFaceForm, 'eye'>,
        slotIds,
        materialIds
      });
    }
  });
  return components;
};

export const readAuthoringFace = (
  value: unknown,
  mode: AuthoringFaceMode | null,
  track: AuthoringTrack | null,
  slots: readonly AuthoringSlotAssignment[],
  intent: ProjectIntent | undefined,
  issues: AuthoringProfileIssue[]
): AuthoringFaceContract | null => {
  if (mode === 'none') {
    if (value !== null) {
      addIssue(
        issues,
        'face',
        'Face contract must be null when faceMode is none.',
        'null'
      );
    }
    return null;
  }
  if (mode !== 'full') return null;
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, FACE_KEYS)
  ) {
    addIssue(
      issues,
      'face',
      'Full face must use the closed face contract.',
      '{hostSlotId,mouthState,components,exceptions}'
    );
    return null;
  }
  const slotsById = new Map(slots.map((slot) => [slot.slotId, slot]));
  const hostSlotId = isNonEmptyContractText(value.hostSlotId)
    ? value.hostSlotId
    : null;
  const hostSlot = hostSlotId ? slotsById.get(hostSlotId) : undefined;
  if (!hostSlotId || hostSlot?.structuralRole !== 'focal-frame') {
    addIssue(
      issues,
      'face.hostSlotId',
      'Full face host must reference a declared focal-frame slot.',
      'one focal-frame slot ID from this profile'
    );
  }
  const mouthState = typeof value.mouthState === 'string' &&
    MOUTH_STATES.has(value.mouthState)
    ? value.mouthState as AuthoringFaceContract['mouthState']
    : null;
  if (!mouthState) {
    addIssue(
      issues,
      'face.mouthState',
      `Unknown full-face mouth state "${String(value.mouthState)}".`,
      AUTHORING_MOUTH_STATES.join(' | ')
    );
  }
  const components = readComponents(
    value.components,
    hostSlotId,
    slotsById,
    issues
  );
  const exceptions = readAuthoringFaceExceptions(
    value.exceptions,
    intent,
    issues
  );
  validateAuthoringFaceDeclarations(
    track,
    mouthState,
    components,
    exceptions,
    issues
  );
  if (!hostSlotId || !hostSlot || !mouthState) return null;
  return {
    hostSlotId,
    mouthState,
    components: [...components].sort((left, right) =>
      left.component.localeCompare(right.component)
    ),
    exceptions: [...exceptions].sort((left, right) =>
      left.component.localeCompare(right.component)
    )
  };
};
