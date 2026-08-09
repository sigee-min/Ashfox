import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import { PART_CONTRACT_LIMITS } from '../modeling/partContract';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import { AUTHORING_PART_ID_PATTERN } from './authoringProfilePrimitives';
import {
  AUTHORING_CONTACTS,
  AUTHORING_SLOT_SYMMETRY_KINDS,
  type AuthoringFootDigit,
  type AuthoringSlotSymmetry,
  type AuthoringSupport
} from './authoringTypes';

const SYMMETRY_KIND_KEYS = new Set(['kind']);
const PAIRED_SYMMETRY_KEYS = new Set(['kind', 'pairId']);
const SUPPORT_NONE_KEYS = new Set(['kind']);
const SUPPORT_BASE_KEYS = new Set(['kind', 'contact', 'supportPartIds']);
const SUPPORT_WHEEL_KEYS = new Set(['kind', 'contact', 'wheelPartIds']);
const SUPPORT_FOOT_KEYS = new Set([
  'kind',
  'contact',
  'rootPartId',
  'solePartIds',
  'digits'
]);
const FOOT_DIGIT_KEYS = new Set([
  'digitId',
  'toePartIds',
  'clawPartIds'
]);
const CONTACTS = new Set<string>(AUTHORING_CONTACTS);
const SYMMETRY_KINDS = new Set<string>(AUTHORING_SLOT_SYMMETRY_KINDS);

export const isCanonicalAuthoringSlotId = (
  value: unknown
): value is string =>
  isNonEmptyContractText(value) &&
  value.length <= PART_CONTRACT_LIMITS.maxIdLength &&
  AUTHORING_PART_ID_PATTERN.test(value);

const readOwnedIds = (
  value: unknown,
  path: string,
  owned: ReadonlySet<string>,
  allowEmpty: boolean,
  issues: AuthoringProfileIssue[]
): readonly string[] | null => {
  if (
    !isUniqueContractTextArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner ||
    value.some((id) => !isCanonicalAuthoringSlotId(id) || !owned.has(id))
  ) {
    addIssue(
      issues,
      path,
      'Support part IDs must be unique canonical IDs owned by this slot.',
      `${allowEmpty ? '0' : '1'}-${AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner} IDs from slot.partIds`
    );
    return null;
  }
  return [...value].sort((left, right) => left.localeCompare(right));
};

export const readAuthoringSlotSymmetry = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): AuthoringSlotSymmetry | null => {
  if (!isClosedContractRecord(value) || typeof value.kind !== 'string') {
    addIssue(
      issues,
      path,
      'Slot symmetry must use a closed discriminated contract.',
      '{kind:centered|asymmetric} | {kind:paired,pairId}'
    );
    return null;
  }
  if (!SYMMETRY_KINDS.has(value.kind)) {
    addIssue(
      issues,
      `${path}.kind`,
      `Unknown slot symmetry kind "${value.kind}".`,
      AUTHORING_SLOT_SYMMETRY_KINDS.join(' | ')
    );
    return null;
  }
  if (value.kind === 'paired') {
    if (
      !hasExactContractKeys(value, PAIRED_SYMMETRY_KEYS) ||
      !isCanonicalAuthoringSlotId(value.pairId)
    ) {
      addIssue(
        issues,
        path,
        'Paired slot symmetry requires one canonical pair ID.',
        '{kind:"paired",pairId}'
      );
      return null;
    }
    return { kind: 'paired', pairId: value.pairId };
  }
  if (!hasExactContractKeys(value, SYMMETRY_KIND_KEYS)) {
    addIssue(
      issues,
      path,
      'Centered/asymmetric symmetry accepts no additional fields.',
      `{kind:"${value.kind}"}`
    );
    return null;
  }
  return { kind: value.kind } as AuthoringSlotSymmetry;
};

const readFootDigits = (
  value: unknown,
  path: string,
  owned: ReadonlySet<string>,
  issues: AuthoringProfileIssue[]
): readonly AuthoringFootDigit[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner
  ) {
    addIssue(
      issues,
      path,
      'Foot support requires a bounded non-empty digit array.',
      'one or more typed toe/claw digit declarations'
    );
    return null;
  }
  const digits: AuthoringFootDigit[] = [];
  value.forEach((entry, index) => {
    const digitPath = `${path}[${index}]`;
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, FOOT_DIGIT_KEYS) ||
      !isCanonicalAuthoringSlotId(entry.digitId)
    ) {
      addIssue(
        issues,
        digitPath,
        'Foot digit must use the closed canonical contract.',
        '{digitId,toePartIds,clawPartIds}'
      );
      return;
    }
    const toePartIds = readOwnedIds(
      entry.toePartIds,
      `${digitPath}.toePartIds`,
      owned,
      false,
      issues
    );
    const clawPartIds = readOwnedIds(
      entry.clawPartIds,
      `${digitPath}.clawPartIds`,
      owned,
      true,
      issues
    );
    if (toePartIds && clawPartIds) {
      digits.push({ digitId: entry.digitId, toePartIds, clawPartIds });
    }
  });
  if (new Set(digits.map((digit) => digit.digitId)).size !== digits.length) {
    addIssue(
      issues,
      path,
      'Foot digit IDs must be unique.',
      'unique digitId values'
    );
  }
  return digits.length === value.length
    ? [...digits].sort((left, right) =>
        left.digitId.localeCompare(right.digitId)
      )
    : null;
};

export const readAuthoringSlotSupport = (
  value: unknown,
  path: string,
  partIds: readonly string[] | null,
  issues: AuthoringProfileIssue[]
): AuthoringSupport | null => {
  const owned = new Set(partIds ?? []);
  if (!isClosedContractRecord(value) || typeof value.kind !== 'string') {
    addIssue(
      issues,
      path,
      'Support must use a closed discriminated contract.',
      'none | base | foot | wheel support contract'
    );
    return null;
  }
  if (value.kind === 'none') {
    if (!hasExactContractKeys(value, SUPPORT_NONE_KEYS)) {
      addIssue(
        issues,
        path,
        'None support accepts no fields.',
        '{kind:"none"}'
      );
      return null;
    }
    return { kind: 'none' };
  }
  const contact = typeof value.contact === 'string' && CONTACTS.has(value.contact)
    ? value.contact as 'grounded' | 'free'
    : null;
  if (!contact) {
    addIssue(
      issues,
      `${path}.contact`,
      `Unknown support contact "${String(value.contact)}".`,
      AUTHORING_CONTACTS.join(' | ')
    );
  }
  if (value.kind === 'base') {
    const keysValid = hasExactContractKeys(value, SUPPORT_BASE_KEYS);
    const supportPartIds = readOwnedIds(
      value.supportPartIds,
      `${path}.supportPartIds`,
      owned,
      false,
      issues
    );
    if (!keysValid) {
      addIssue(
        issues,
        path,
        'Base support must use the closed contract shape.',
        '{kind:"base",contact,supportPartIds}'
      );
    }
    return keysValid && contact && supportPartIds
      ? { kind: 'base', contact, supportPartIds }
      : null;
  }
  if (value.kind === 'wheel') {
    const keysValid = hasExactContractKeys(value, SUPPORT_WHEEL_KEYS);
    const wheelPartIds = readOwnedIds(
      value.wheelPartIds,
      `${path}.wheelPartIds`,
      owned,
      false,
      issues
    );
    if (!keysValid) {
      addIssue(
        issues,
        path,
        'Wheel support must use the closed contract shape.',
        '{kind:"wheel",contact,wheelPartIds}'
      );
    }
    return keysValid && contact && wheelPartIds
      ? { kind: 'wheel', contact, wheelPartIds }
      : null;
  }
  if (value.kind !== 'foot') {
    addIssue(
      issues,
      `${path}.kind`,
      `Unknown support kind "${value.kind}".`,
      'none | base | foot | wheel'
    );
    return null;
  }
  const keysValid = hasExactContractKeys(value, SUPPORT_FOOT_KEYS);
  const rootPartId = isCanonicalAuthoringSlotId(value.rootPartId) &&
    owned.has(value.rootPartId)
    ? value.rootPartId
    : null;
  if (!rootPartId) {
    addIssue(
      issues,
      `${path}.rootPartId`,
      'Foot root must be one canonical part owned by this slot.',
      'one ID from slot.partIds'
    );
  }
  const solePartIds = readOwnedIds(
    value.solePartIds,
    `${path}.solePartIds`,
    owned,
    false,
    issues
  );
  const digits = readFootDigits(value.digits, `${path}.digits`, owned, issues);
  if (!keysValid) {
    addIssue(
      issues,
      path,
      'Foot support must use the closed contract shape.',
      '{kind:"foot",contact,rootPartId,solePartIds,digits}'
    );
  }
  const classified = [
    ...(rootPartId ? [rootPartId] : []),
    ...(solePartIds ?? []),
    ...(digits ?? []).flatMap((digit) => [
      ...digit.toePartIds,
      ...digit.clawPartIds
    ])
  ];
  if (new Set(classified).size !== classified.length) {
    addIssue(
      issues,
      path,
      'Foot root, sole, toe, and claw roles must be disjoint.',
      'each support part ID assigned exactly one anatomical role'
    );
  }
  return keysValid && contact && rootPartId && solePartIds && digits &&
    new Set(classified).size === classified.length
    ? { kind: 'foot', contact, rootPartId, solePartIds, digits }
    : null;
};
