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
import { AUTHORING_PART_ID_PATTERN } from './authoringProfilePrimitives';
import { authoringTrackPolicy } from './authoringTrackPolicies';
import {
  AUTHORING_EYE_CONFIGURATIONS,
  AUTHORING_FACE_COMPONENTS,
  AUTHORING_FACE_FORMS,
  AUTHORING_MOUTH_STATES,
  type AuthoringFaceComponent,
  type AuthoringFaceComponentDeclaration,
  type AuthoringFaceContract,
  type AuthoringFaceException,
  type AuthoringFaceForm,
  type AuthoringFaceMode,
  type AuthoringSlotAssignment,
  type AuthoringTrack
} from './authoringTypes';

const FACE_KEYS = new Set([
  'hostSlotId',
  'mouthState',
  'components',
  'exceptions'
]);
const FACE_COMPONENT_KEYS = new Set([
  'component',
  'form',
  'configuration',
  'slotIds',
  'materialIds'
]);
const FACE_EXCEPTION_KEYS = new Set([
  'component',
  'basis',
  'referenceIds',
  'rationale'
]);
const FACE_COMPONENTS = new Set<string>(AUTHORING_FACE_COMPONENTS);
const FACE_FORMS = new Set<string>(AUTHORING_FACE_FORMS);
const EYE_CONFIGURATIONS = new Set<string>(AUTHORING_EYE_CONFIGURATIONS);
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
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, FACE_COMPONENT_KEYS)
    ) {
      addIssue(
        issues,
        path,
        'Face component must use the closed contract shape.',
        '{component,form,configuration,slotIds,materialIds}'
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
    const configuration = typeof entry.configuration === 'string' &&
      EYE_CONFIGURATIONS.has(entry.configuration)
      ? entry.configuration as AuthoringFaceComponentDeclaration['configuration']
      : entry.configuration === null
        ? null
        : undefined;
    const configurationValid = configuration !== undefined &&
      (component === 'eye' ? configuration !== null : configuration === null);
    if (!configurationValid) {
      addIssue(
        issues,
        `${path}.configuration`,
        'Only an eye component may declare a non-null eye configuration.',
        component === 'eye'
          ? AUTHORING_EYE_CONFIGURATIONS.join(' | ')
          : 'null'
      );
    }
    const slotIds = readTargetIds(
      entry.slotIds,
      `${path}.slotIds`,
      AUTHORING_PROFILE_LIMITS.maxSlots,
      issues
    );
    const materialIds = readTargetIds(
      entry.materialIds,
      `${path}.materialIds`,
      AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
      issues
    );
    const slotsValid = slotIds !== null && slotIds.every((slotId) => {
      if (!slotsById.has(slotId)) {
        addIssue(
          issues,
          `${path}.slotIds`,
          `Face component references undeclared slot "${slotId}".`,
          'declared slots below the focal-frame host'
        );
        return false;
      }
      if (hostSlotId && !slotDescendsFrom(slotId, hostSlotId, slotsById)) {
        addIssue(
          issues,
          `${path}.slotIds`,
          `Face component slot "${slotId}" is not below host "${hostSlotId}".`,
          'a descendant slot of the focal-frame host'
        );
        return false;
      }
      return true;
    });
    if (
      component &&
      form &&
      semanticPair &&
      configurationValid &&
      slotIds &&
      materialIds &&
      slotsValid
    ) {
      components.push({
        component,
        form,
        configuration: configuration as AuthoringFaceComponentDeclaration['configuration'],
        slotIds,
        materialIds
      });
    }
  });
  return components;
};

const readExceptions = (
  value: unknown,
  intent: ProjectIntent | undefined,
  issues: AuthoringProfileIssue[]
): readonly AuthoringFaceException[] => {
  if (!isDenseContractArray(value) || value.length > 2) {
    addIssue(
      issues,
      'face.exceptions',
      'Face exceptions must be a bounded dense array.',
      'zero to two nasal/oral species exceptions'
    );
    return [];
  }
  const observedRefs = new Set(
    intent?.references?.map((reference) => reference.id) ?? []
  );
  const requestedRefs = new Set([
    'intent.subject',
    ...(intent?.features.map((_, index) => `intent.features.${index}`) ?? [])
  ]);
  const exceptions: AuthoringFaceException[] = [];
  value.forEach((entry, index) => {
    const path = `face.exceptions[${index}]`;
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, FACE_EXCEPTION_KEYS)
    ) {
      addIssue(
        issues,
        path,
        'Species exception must use the closed contract shape.',
        '{component,basis,referenceIds,rationale}'
      );
      return;
    }
    const component = entry.component === 'nasal' || entry.component === 'oral'
      ? entry.component
      : null;
    const basis = entry.basis === 'observed' || entry.basis === 'requested'
      ? entry.basis
      : null;
    const referenceIds = isUniqueContractTextArray(entry.referenceIds) &&
      entry.referenceIds.length > 0 &&
      entry.referenceIds.length <= AUTHORING_PROFILE_LIMITS.maxClaimReferenceIds
      ? [...entry.referenceIds].sort((left, right) =>
          left.localeCompare(right)
        )
      : null;
    const allowedRefs = basis === 'observed' ? observedRefs : requestedRefs;
    const referencesValid = referenceIds !== null &&
      referenceIds.every((referenceId) => allowedRefs.has(referenceId));
    const rationale = isNonEmptyContractText(entry.rationale) &&
      entry.rationale.length <= AUTHORING_PROFILE_LIMITS.maxClaimRationaleLength
      ? entry.rationale.trim()
      : null;
    if (!component || !basis || !referencesValid || !rationale) {
      addIssue(
        issues,
        path,
        'Nasal/oral omission requires auditable species evidence.',
        'nasal or oral + observed/requested current references + species rationale'
      );
      return;
    }
    exceptions.push({ component, basis, referenceIds, rationale });
  });
  return exceptions;
};

const validateFaceDeclarations = (
  track: AuthoringTrack | null,
  mouthState: AuthoringFaceContract['mouthState'] | null,
  components: readonly AuthoringFaceComponentDeclaration[],
  exceptions: readonly AuthoringFaceException[],
  issues: AuthoringProfileIssue[]
): void => {
  for (const component of AUTHORING_FACE_COMPONENTS) {
    if (components.filter((entry) => entry.component === component).length > 1) {
      addIssue(
        issues,
        'face.components',
        `Face component "${component}" may be declared only once.`,
        'one declaration per semantic component'
      );
    }
  }
  const slotOwners = new Map<string, AuthoringFaceComponent[]>();
  for (const component of components) {
    for (const slotId of component.slotIds) {
      slotOwners.set(slotId, [
        ...(slotOwners.get(slotId) ?? []),
        component.component
      ]);
    }
  }
  for (const [slotId, owners] of slotOwners) {
    if (owners.length > 1) {
      addIssue(
        issues,
        'face.components',
        `Face slot "${slotId}" is reused across semantic components.`,
        'component-exclusive descendant slots with explicit parts'
      );
    }
  }
  for (const component of ['nasal', 'oral'] as const) {
    const matches = exceptions.filter((entry) => entry.component === component);
    if (matches.length > 1) {
      addIssue(
        issues,
        'face.exceptions',
        `Species exception "${component}" may be declared only once.`,
        'at most one exception per omittable component'
      );
    }
    if (
      matches.length > 0 &&
      components.some((entry) => entry.component === component)
    ) {
      addIssue(
        issues,
        'face',
        `Face component "${component}" cannot be both realized and excepted.`,
        'either one actual component or one species exception'
      );
    }
  }
  const has = (component: AuthoringFaceComponent): boolean =>
    components.some((entry) => entry.component === component);
  const excepted = (component: 'nasal' | 'oral'): boolean =>
    exceptions.some((entry) => entry.component === component);
  const policy = track === null ? null : authoringTrackPolicy(track);
  for (const component of policy?.face.requiredComponents ?? []) {
    const satisfied = has(component) ||
      (component === 'nasal' && excepted('nasal')) ||
      (component === 'oral' && excepted('oral'));
    if (satisfied) continue;
    addIssue(
      issues,
      'face.components',
      `${policy?.label ?? 'Selected'} full face requires a ${component} component.`,
      component === 'eye'
        ? 'one readable configured eye component'
        : component === 'nasal'
          ? 'nose, muzzle, beak, or nasal species exception'
          : component === 'oral'
            ? 'mouth, jaw, beak, or oral species exception'
            : `one exclusive ${component} component`
    );
  }
  if (mouthState === 'absent') {
    if (!excepted('oral') || has('oral') || has('jaw') || has('mouth-interior')) {
      addIssue(
        issues,
        'face.mouthState',
        'Absent mouth must match one oral species exception and no oral geometry.',
        'mouthState absent + oral exception + no oral/jaw/mouth-interior component'
      );
    }
  } else if (mouthState) {
    const oral = components.find((entry) => entry.component === 'oral');
    if (!oral || excepted('oral')) {
      addIssue(
        issues,
        'face.components',
        'Present mouth state requires an actual oral component.',
        'one oral component and no oral exception'
      );
    }
    if (mouthState === 'beak' && oral?.form !== 'beak') {
      addIssue(
        issues,
        'face.mouthState',
        'Beak mouth state requires a beak oral form.',
        'oral form beak'
      );
    }
    if (mouthState !== 'beak' && oral?.form === 'beak') {
      addIssue(
        issues,
        'face.mouthState',
        'Beak oral form requires mouthState beak.',
        'mouthState beak'
      );
    }
  }
  if (
    policy?.face.requireJawWhenMouthPresent &&
    mouthState !== 'absent' &&
    !has('jaw')
  ) {
    addIssue(
      issues,
      'face.components',
      `${policy.label} full face requires a separate jaw.`,
      'one jaw component'
    );
  }
  if (
    policy?.face.requireInteriorWhenMouthOpen &&
    mouthState === 'open' &&
    !has('mouth-interior')
  ) {
    addIssue(
      issues,
      'face.components',
      `Open ${policy.label} face requires a separate mouth interior.`,
      'one mouth-interior component'
    );
  }
  if (mouthState !== 'open' && has('mouth-interior')) {
    addIssue(
      issues,
      'face.components',
      'Mouth interior is only valid for an open mouth state.',
      'remove mouth-interior or set mouthState open'
    );
  }
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
  const exceptions = readExceptions(value.exceptions, intent, issues);
  validateFaceDeclarations(track, mouthState, components, exceptions, issues);
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
