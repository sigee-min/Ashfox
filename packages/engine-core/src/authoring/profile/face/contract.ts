import {
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import { PART_CONTRACT_LIMITS } from '../../../modeling/part';
import {
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../evidence';
import { AUTHORING_PART_ID_PATTERN } from '../primitives';
import {
  AUTHORING_EYE_PALETTES,
  AUTHORING_FACE_COMPONENTS,
  AUTHORING_FACE_FORMS,
  AUTHORING_MOUTH_STATES,
  type AuthoringFaceComponent,
  type AuthoringFaceForm
} from '../../contract';

export const FACE_KEYS = new Set([
  'hostSlotId',
  'mouthState',
  'components',
  'exceptions'
]);

export const EYE_COMPONENT_KEYS = new Set([
  'component',
  'form',
  'configuration',
  'gaze',
  'palette',
  'materialIds'
]);

export const NON_EYE_COMPONENT_KEYS = new Set([
  'component',
  'form',
  'slotIds',
  'materialIds'
]);

export const SINGLE_EYE_CONFIGURATION_KEYS = new Set(['kind', 'slotId']);
export const PAIRED_EYE_CONFIGURATION_KEYS = new Set([
  'kind',
  'leftSlotId',
  'rightSlotId'
]);

export const FACE_COMPONENT_SET = new Set<string>(AUTHORING_FACE_COMPONENTS);
export const FACE_FORM_SET = new Set<string>(AUTHORING_FACE_FORMS);
export const EYE_PALETTE_SET = new Set<string>(AUTHORING_EYE_PALETTES);
export const MOUTH_STATE_SET = new Set<string>(AUTHORING_MOUTH_STATES);

export const FACE_FORMS_BY_COMPONENT: Readonly<
  Record<AuthoringFaceComponent, readonly AuthoringFaceForm[]>
> = {
  eye: ['eye'],
  nasal: ['nose', 'muzzle', 'beak'],
  oral: ['mouth', 'jaw', 'beak'],
  'eye-frame': ['orbital', 'brow'],
  jaw: ['jaw'],
  'mouth-interior': ['mouth-interior']
};

export const readFaceTargetIds = (
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
    addAuthoringProfileIssue(
      issues,
      path,
      'Full-face component targets must be non-empty unique canonical IDs.',
      `1-${limit} canonical IDs`
    );
    return null;
  }
  return [...value].sort((left, right) => left.localeCompare(right));
};
