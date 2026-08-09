import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray
} from '@ashfox/internal-contracts';

import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../evidence';
import {
  FACE_COMPONENT_SET,
  FACE_FORMS_BY_COMPONENT,
  FACE_FORM_SET,
  NON_EYE_COMPONENT_KEYS,
  readFaceTargetIds
} from './contract';
import { readAuthoringEyeComponent } from './eye';
import { validateFaceComponentSlots } from './topology';
import {
  AUTHORING_FACE_COMPONENTS,
  type AuthoringFaceComponent,
  type AuthoringFaceComponentDeclaration,
  type AuthoringFaceForm,
  type AuthoringNonEyeFaceComponentDeclaration,
  type AuthoringSlotAssignment
} from '../../contract';

const readNonEyeComponent = (
  entry: Readonly<Record<string, unknown>>,
  component: Exclude<AuthoringFaceComponent, 'eye'>,
  form: Exclude<AuthoringFaceForm, 'eye'>,
  path: string,
  materialIds: readonly string[],
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): AuthoringNonEyeFaceComponentDeclaration | null => {
  if (!hasExactContractKeys(entry, NON_EYE_COMPONENT_KEYS)) {
    addAuthoringProfileIssue(
      issues,
      path,
      'Non-eye face component must use the closed slot contract.',
      '{component,form,slotIds,materialIds}'
    );
    return null;
  }
  const slotIds = readFaceTargetIds(
    entry.slotIds,
    `${path}.slotIds`,
    AUTHORING_PROFILE_LIMITS.maxSlots,
    issues
  );
  const slotsValid = slotIds !== null && validateFaceComponentSlots(
    slotIds,
    `${path}.slotIds`,
    hostSlotId,
    slotsById,
    issues
  );
  return slotIds && slotsValid
    ? { component, form, slotIds, materialIds }
    : null;
};

export const readAuthoringFaceComponents = (
  value: unknown,
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): readonly AuthoringFaceComponentDeclaration[] => {
  if (
    !isDenseContractArray(value) ||
    value.length > AUTHORING_FACE_COMPONENTS.length
  ) {
    addAuthoringProfileIssue(
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
      addAuthoringProfileIssue(
        issues,
        path,
        'Face component must be a closed contract record.',
        'eye or non-eye component contract'
      );
      return;
    }
    const component = typeof entry.component === 'string' &&
      FACE_COMPONENT_SET.has(entry.component)
      ? entry.component as AuthoringFaceComponent
      : null;
    const form = typeof entry.form === 'string' &&
      FACE_FORM_SET.has(entry.form)
      ? entry.form as AuthoringFaceForm
      : null;
    const semanticPair = component !== null && form !== null &&
      FACE_FORMS_BY_COMPONENT[component].includes(form);
    if (!semanticPair) {
      addAuthoringProfileIssue(
        issues,
        path,
        'Face component and form are not a valid semantic pair.',
        'eye; nasal nose/muzzle/beak; oral mouth/jaw/beak; eye-frame orbital/brow; jaw; or mouth-interior'
      );
    }
    const materialIds = readFaceTargetIds(
      entry.materialIds,
      `${path}.materialIds`,
      AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
      issues
    );
    if (!component || !form || !semanticPair || !materialIds) return;
    const declaration = component === 'eye'
      ? readAuthoringEyeComponent(
          entry,
          path,
          materialIds,
          hostSlotId,
          slotsById,
          issues
        )
      : readNonEyeComponent(
          entry,
          component,
          form as Exclude<AuthoringFaceForm, 'eye'>,
          path,
          materialIds,
          hostSlotId,
          slotsById,
          issues
        );
    if (declaration) components.push(declaration);
  });
  return components;
};
