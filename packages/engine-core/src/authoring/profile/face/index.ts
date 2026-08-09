import {
  hasExactContractKeys,
  isClosedContractRecord,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import type { ProjectIntent } from '../../../model';
import {
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../evidence';
import {
  FACE_KEYS,
  MOUTH_STATE_SET
} from './contract';
import { readAuthoringFaceComponents } from './components';
import { readAuthoringFaceExceptions } from './evidence';
import { validateAuthoringFaceDeclarations } from './policy';
import {
  validateAuthoringFaceHost,
  validateEyeSurfaceHosts
} from './topology';
import {
  AUTHORING_MOUTH_STATES,
  type AuthoringFaceContract,
  type AuthoringFaceMode,
  type AuthoringSlotAssignment,
  type AuthoringTrack
} from '../../contract';

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
      addAuthoringProfileIssue(
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
    addAuthoringProfileIssue(
      issues,
      'face',
      'Full face must use the closed face contract.',
      '{hostSlotId,mouthState,components,exceptions}'
    );
    return null;
  }

  const slotsById = new Map(slots.map((slot) => [slot.slotId, slot]));
  const hostValidation = validateAuthoringFaceHost(
    isNonEmptyContractText(value.hostSlotId) ? value.hostSlotId : null,
    slotsById,
    intent,
    issues
  );
  const mouthState = typeof value.mouthState === 'string' &&
    MOUTH_STATE_SET.has(value.mouthState)
    ? value.mouthState as AuthoringFaceContract['mouthState']
    : null;
  if (!mouthState) {
    addAuthoringProfileIssue(
      issues,
      'face.mouthState',
      `Unknown full-face mouth state "${String(value.mouthState)}".`,
      AUTHORING_MOUTH_STATES.join(' | ')
    );
  }

  const components = readAuthoringFaceComponents(
    value.components,
    hostValidation.hostSlotId,
    slotsById,
    issues
  );
  validateEyeSurfaceHosts(
    components,
    hostValidation.hostSlotId,
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
  if (!hostValidation.hostSlotId || !hostValidation.hostSlot || !mouthState) {
    return null;
  }
  return {
    hostSlotId: hostValidation.hostSlotId,
    mouthState,
    components: [...components].sort((left, right) =>
      left.component.localeCompare(right.component)
    ),
    exceptions: [...exceptions].sort((left, right) =>
      left.component.localeCompare(right.component)
    )
  };
};
