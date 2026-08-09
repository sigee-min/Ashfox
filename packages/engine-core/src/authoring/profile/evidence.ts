import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import { canonicalJsonString } from '../../canonicalJson';
import type { ProjectIntent } from '../../model';
import { PROJECT_REFERENCE_ID_PATTERN_SOURCE } from '../../project/intent';
import {
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../quality/issues';
import {
  isArchetypeReference,
  isSpecialistReference,
  resolveArchetypeReference,
  resolveSpecialistReference
} from '../catalog/registry';
import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type ArchetypeReference,
  type AuthoringAuthorityClaim,
  type AuthoringAuthorityReference,
  type SpecialistReference
} from '../contract';
import type {
  ArchetypeDefinition,
  SpecialistDefinition
} from '../catalog/contract';

export const AUTHORING_PROFILE_LIMITS = Object.freeze({
  maxSpecialists: 16,
  maxClaims: 32,
  maxClaimRationaleLength: 480,
  maxClaimReferenceIds: 16,
  maxSlots: 64,
  maxBindings: 32,
  maxPartIdsPerOwner: 32
});

export {
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../quality/issues';

const REFERENCE_KEYS = new Set(['id', 'version']);
const CLAIM_KEYS = new Set([
  'authority',
  'criterionId',
  'basis',
  'referenceIds',
  'rationale'
]);
const OBSERVED_REFERENCE_ID_PATTERN = new RegExp(
  PROJECT_REFERENCE_ID_PATTERN_SOURCE
);
const REQUESTED_REFERENCE_ID_PATTERN =
  /^intent\.(?:subject|features\.(?:0|[1-9][0-9]*))$/;

export const readArchetypeReference = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): ArchetypeReference | null => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, REFERENCE_KEYS) ||
    !isArchetypeReference(value) ||
    !resolveArchetypeReference(value)
  ) {
    addAuthoringProfileIssue(
      issues,
      path,
      'Archetype must be an explicit registered reference.',
      `{id: registered archetype ID, version: ${AUTHORING_PROFILE_SCHEMA_VERSION}}`
    );
    return null;
  }
  return value;
};

export const readSpecialistReference = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): SpecialistReference | null => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, REFERENCE_KEYS) ||
    !isSpecialistReference(value) ||
    !resolveSpecialistReference(value)
  ) {
    addAuthoringProfileIssue(
      issues,
      path,
      'Specialist must be an explicit registered reference.',
      `{id: registered specialist ID, version: ${AUTHORING_PROFILE_SCHEMA_VERSION}}`
    );
    return null;
  }
  return value;
};

export const readSpecialists = (
  value: unknown,
  issues: AuthoringProfileIssue[]
): readonly SpecialistReference[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length > AUTHORING_PROFILE_LIMITS.maxSpecialists
  ) {
    addAuthoringProfileIssue(
      issues,
      'specialists',
      'Specialists must be a bounded array.',
      `0-${AUTHORING_PROFILE_LIMITS.maxSpecialists} explicit registered references`
    );
    return null;
  }
  const specialists = value.flatMap((entry, index) => {
    const reference = readSpecialistReference(
      entry,
      `specialists[${index}]`,
      issues
    );
    return reference ? [reference] : [];
  });
  const ids = specialists.map((reference) => reference.id);
  if (new Set(ids).size !== ids.length) {
    addAuthoringProfileIssue(
      issues,
      'specialists',
      'A specialist may be selected only once.',
      'unique specialist references'
    );
  }
  return [...specialists].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
};

const validRequestedReference = (
  referenceId: string,
  intent: ProjectIntent | undefined
): boolean => {
  if (!REQUESTED_REFERENCE_ID_PATTERN.test(referenceId)) return false;
  if (!intent || referenceId === 'intent.subject') return true;
  const index = Number(referenceId.slice('intent.features.'.length));
  return Number.isSafeInteger(index) && intent.features[index] !== undefined;
};

const readClaimAuthority = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): AuthoringAuthorityReference | null => {
  const localIssues: AuthoringProfileIssue[] = [];
  const archetype = readArchetypeReference(value, path, localIssues);
  if (archetype) return archetype;
  localIssues.length = 0;
  const specialist = readSpecialistReference(value, path, localIssues);
  if (specialist) return specialist;
  issues.push(...localIssues);
  return null;
};

const validateRequiredClaims = (
  claims: readonly AuthoringAuthorityClaim[],
  selectedAuthorities: ReadonlyMap<
    string,
    ArchetypeDefinition | SpecialistDefinition
  >,
  issues: AuthoringProfileIssue[]
): void => {
  for (const [authorityId, definition] of selectedAuthorities) {
    for (const criterion of definition.evidenceCriteria) {
      if (
        criterion.required &&
        !claims.some((claim) =>
          claim.authority.id === authorityId &&
          claim.criterionId === criterion.id
        )
      ) {
        addAuthoringProfileIssue(
          issues,
          'claims',
          `Selected authority "${authorityId}" has no claim for required ` +
            `criterion "${criterion.id}".`,
          'one grounded claim for every required authority criterion'
        );
      }
    }
  }
};

export const readClaims = (
  value: unknown,
  selectedAuthorities: ReadonlyMap<
    string,
    ArchetypeDefinition | SpecialistDefinition
  >,
  intent: ProjectIntent | undefined,
  issues: AuthoringProfileIssue[]
): readonly AuthoringAuthorityClaim[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxClaims
  ) {
    addAuthoringProfileIssue(
      issues,
      'claims',
      'Claims must be a non-empty bounded array.',
      `1-${AUTHORING_PROFILE_LIMITS.maxClaims} grounded claims`
    );
    return null;
  }
  const observedIds = new Set(
    (intent?.references ?? []).map((reference) => reference.id)
  );
  const claims: AuthoringAuthorityClaim[] = [];
  value.forEach((entry, index) => {
    const path = `claims[${index}]`;
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, CLAIM_KEYS)
    ) {
      addAuthoringProfileIssue(
        issues,
        path,
        'Claim must use the closed contract shape.',
        '{authority,criterionId,basis,referenceIds,rationale}'
      );
      return;
    }
    const authority = readClaimAuthority(
      entry.authority,
      `${path}.authority`,
      issues
    );
    const basis = entry.basis;
    if (basis !== 'observed' && basis !== 'requested') {
      addAuthoringProfileIssue(
        issues,
        `${path}.basis`,
        'Claim basis is invalid.',
        'observed | requested'
      );
    }
    const criterionId = entry.criterionId;
    const authorityDefinition = authority
      ? selectedAuthorities.get(authority.id)
      : undefined;
    const criterion = authorityDefinition && typeof criterionId === 'string'
      ? authorityDefinition.evidenceCriteria.find((candidate) =>
          candidate.id === criterionId
        )
      : undefined;
    if (!isNonEmptyContractText(criterionId) || !criterion) {
      addAuthoringProfileIssue(
        issues,
        `${path}.criterionId`,
        `Evidence criterion "${String(criterionId)}" is not owned by the claim authority.`,
        'an evidenceCriteria ID declared by the referenced authority'
      );
    } else if (
      (basis === 'observed' || basis === 'requested') &&
      criterion.basis !== 'either' &&
      criterion.basis !== basis
    ) {
      addAuthoringProfileIssue(
        issues,
        `${path}.basis`,
        `Criterion "${criterion.id}" requires ${criterion.basis} evidence.`,
        criterion.basis
      );
    }
    const referenceIds = entry.referenceIds;
    if (
      !isUniqueContractTextArray(referenceIds) ||
      referenceIds.length === 0 ||
      referenceIds.length > AUTHORING_PROFILE_LIMITS.maxClaimReferenceIds
    ) {
      addAuthoringProfileIssue(
        issues,
        `${path}.referenceIds`,
        'Claim references must be a non-empty unique bounded array.',
        `1-${AUTHORING_PROFILE_LIMITS.maxClaimReferenceIds} provenance IDs`
      );
    } else if (basis === 'observed') {
      const invalid = referenceIds.find((id) =>
        intent
          ? !observedIds.has(id)
          : !OBSERVED_REFERENCE_ID_PATTERN.test(id)
      );
      if (invalid) {
        addAuthoringProfileIssue(
          issues,
          `${path}.referenceIds`,
          `Observed claim reference "${invalid}" is not present in intent.references.`,
          'IDs of current ProjectIntent.references records'
        );
      }
    } else if (basis === 'requested') {
      const invalid = referenceIds.find((id) =>
        !validRequestedReference(id, intent)
      );
      if (invalid) {
        addAuthoringProfileIssue(
          issues,
          `${path}.referenceIds`,
          `Requested claim reference "${invalid}" does not identify current intent text.`,
          'intent.subject or an existing intent.features.N path'
        );
      }
    }
    if (
      !isNonEmptyContractText(entry.rationale) ||
      entry.rationale.length > AUTHORING_PROFILE_LIMITS.maxClaimRationaleLength
    ) {
      addAuthoringProfileIssue(
        issues,
        `${path}.rationale`,
        'Claim rationale is empty or too long.',
        `1-${AUTHORING_PROFILE_LIMITS.maxClaimRationaleLength} characters`
      );
    }
    if (authority && !selectedAuthorities.has(authority.id)) {
      addAuthoringProfileIssue(
        issues,
        `${path}.authority`,
        `Claim authority "${authority.id}" is not selected.`,
        'the selected archetype or one selected specialist'
      );
    }
    if (
      authority &&
      criterion &&
      (basis === 'observed' || basis === 'requested') &&
      (criterion.basis === 'either' || criterion.basis === basis) &&
      isUniqueContractTextArray(referenceIds) &&
      isNonEmptyContractText(entry.rationale)
    ) {
      claims.push({
        authority,
        criterionId: criterion.id,
        basis,
        referenceIds: [...referenceIds].sort((left, right) =>
          left.localeCompare(right)
        ),
        rationale: entry.rationale
      });
    }
  });
  validateRequiredClaims(claims, selectedAuthorities, issues);
  const claimKeys = claims.map((claim) => canonicalJsonString(claim));
  if (new Set(claimKeys).size !== claimKeys.length) {
    addAuthoringProfileIssue(
      issues,
      'claims',
      'Duplicate authority claims are not allowed.',
      'unique claims'
    );
  }
  return [...claims].sort((left, right) =>
    canonicalJsonString(left).localeCompare(canonicalJsonString(right))
  );
};
