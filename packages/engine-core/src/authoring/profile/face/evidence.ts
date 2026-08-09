import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import type { ProjectIntent } from '../../../model';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from '../evidence';
import type { AuthoringFaceException } from '../../contract';

const FACE_EXCEPTION_KEYS = new Set([
  'component',
  'basis',
  'referenceIds',
  'rationale'
]);

export const readAuthoringFaceExceptions = (
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
