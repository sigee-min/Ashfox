import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import {
  isCanonicalAuthoringSlotId
} from './authoringProfileSlotContracts';
import type {
  AuthoringSpan,
  AuthoringSpanMembrane,
  AuthoringSpanSpar
} from './authoringSpanTypes';
import type { AuthoringStructuralRole } from './authoringTypes';

const NONE_KEYS = new Set(['kind']);
const SUPPORTED_SURFACE_KEYS = new Set([
  'kind',
  'obligationId',
  'rootPartIds',
  'spars',
  'membranes'
]);
const SPAR_KEYS = new Set(['sparId', 'partIds']);
const MEMBRANE_KEYS = new Set([
  'membraneId',
  'partIds',
  'boundedBySparIds'
]);

const readOwnedPartIds = (
  value: unknown,
  path: string,
  owned: ReadonlySet<string>,
  issues: AuthoringProfileIssue[]
): readonly string[] | null => {
  if (
    !isUniqueContractTextArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner ||
    value.some((id) =>
      !isCanonicalAuthoringSlotId(id) || !owned.has(id)
    )
  ) {
    addIssue(
      issues,
      path,
      'Span region part IDs must be unique canonical IDs owned by this slot.',
      `1-${AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner} IDs from slot.partIds`
    );
    return null;
  }
  return [...value].sort((left, right) => left.localeCompare(right));
};

const readSpars = (
  value: unknown,
  path: string,
  owned: ReadonlySet<string>,
  issues: AuthoringProfileIssue[]
): readonly AuthoringSpanSpar[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length < 2 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner
  ) {
    addIssue(
      issues,
      path,
      'Supported surfaces require at least two bounded spar regions.',
      `2-${AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner} spar declarations`
    );
    return null;
  }
  const spars: AuthoringSpanSpar[] = [];
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, SPAR_KEYS) ||
      !isCanonicalAuthoringSlotId(entry.sparId)
    ) {
      addIssue(
        issues,
        entryPath,
        'Span spar must use the closed canonical contract.',
        '{sparId,partIds}'
      );
      return;
    }
    const partIds = readOwnedPartIds(
      entry.partIds,
      `${entryPath}.partIds`,
      owned,
      issues
    );
    if (partIds) spars.push({ sparId: entry.sparId, partIds });
  });
  if (new Set(spars.map((spar) => spar.sparId)).size !== spars.length) {
    addIssue(issues, path, 'Span spar IDs must be unique.', 'unique sparId values');
  }
  return spars.length === value.length &&
    new Set(spars.map((spar) => spar.sparId)).size === spars.length
    ? [...spars].sort((left, right) =>
        left.sparId.localeCompare(right.sparId)
      )
    : null;
};

const readBoundaries = (
  value: unknown,
  path: string,
  sparIds: ReadonlySet<string>,
  issues: AuthoringProfileIssue[]
): readonly [string, string] | null => {
  if (
    !isUniqueContractTextArray(value) ||
    value.length !== 2 ||
    value.some((id) =>
      !isCanonicalAuthoringSlotId(id) || !sparIds.has(id)
    )
  ) {
    addIssue(
      issues,
      path,
      'A membrane must name exactly two distinct declared spar boundaries.',
      'two unique sparId values declared by this span'
    );
    return null;
  }
  return [...value].sort((left, right) =>
    left.localeCompare(right)
  ) as [string, string];
};

const readMembranes = (
  value: unknown,
  path: string,
  owned: ReadonlySet<string>,
  sparIds: ReadonlySet<string>,
  issues: AuthoringProfileIssue[]
): readonly AuthoringSpanMembrane[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner
  ) {
    addIssue(
      issues,
      path,
      'Supported surfaces require a bounded non-empty membrane array.',
      `1-${AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner} membrane declarations`
    );
    return null;
  }
  const membranes: AuthoringSpanMembrane[] = [];
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, MEMBRANE_KEYS) ||
      !isCanonicalAuthoringSlotId(entry.membraneId)
    ) {
      addIssue(
        issues,
        entryPath,
        'Span membrane must use the closed canonical contract.',
        '{membraneId,partIds,boundedBySparIds}'
      );
      return;
    }
    const partIds = readOwnedPartIds(
      entry.partIds,
      `${entryPath}.partIds`,
      owned,
      issues
    );
    const boundedBySparIds = readBoundaries(
      entry.boundedBySparIds,
      `${entryPath}.boundedBySparIds`,
      sparIds,
      issues
    );
    if (partIds && boundedBySparIds) {
      membranes.push({
        membraneId: entry.membraneId,
        partIds,
        boundedBySparIds
      });
    }
  });
  if (
    new Set(membranes.map((membrane) => membrane.membraneId)).size !==
    membranes.length
  ) {
    addIssue(
      issues,
      path,
      'Span membrane IDs must be unique.',
      'unique membraneId values'
    );
  }
  return membranes.length === value.length &&
    new Set(membranes.map((membrane) => membrane.membraneId)).size ===
      membranes.length
    ? [...membranes].sort((left, right) =>
        left.membraneId.localeCompare(right.membraneId)
      )
    : null;
};

const validateExhaustiveRegions = (
  partIds: readonly string[],
  rootPartIds: readonly string[],
  spars: readonly AuthoringSpanSpar[],
  membranes: readonly AuthoringSpanMembrane[],
  path: string,
  issues: AuthoringProfileIssue[]
): boolean => {
  const classified = [
    ...rootPartIds,
    ...spars.flatMap((spar) => spar.partIds),
    ...membranes.flatMap((membrane) => membrane.partIds)
  ];
  const classifiedSet = new Set(classified);
  const duplicates = [...classifiedSet].filter((partId) =>
    classified.filter((candidate) => candidate === partId).length > 1
  );
  const unclassified = partIds.filter((partId) => !classifiedSet.has(partId));
  if (
    duplicates.length === 0 &&
    unclassified.length === 0 &&
    classified.length === partIds.length
  ) {
    return true;
  }
  addIssue(
    issues,
    path,
    'Span root, spar, and membrane regions must be disjoint and exhaust the slot.',
    'every slot.partIds member assigned exactly once to one span region'
  );
  return false;
};

export const readAuthoringSlotSpan = (
  value: unknown,
  path: string,
  structuralRole: AuthoringStructuralRole | null,
  partIds: readonly string[] | null,
  issues: AuthoringProfileIssue[]
): AuthoringSpan | null => {
  if (!isClosedContractRecord(value) || typeof value.kind !== 'string') {
    addIssue(
      issues,
      path,
      'Span must use a closed discriminated contract.',
      'non-span {kind:"none"} | span {kind:"supported-surface",...}'
    );
    return null;
  }
  if (structuralRole !== 'span') {
    if (value.kind !== 'none' || !hasExactContractKeys(value, NONE_KEYS)) {
      addIssue(
        issues,
        path,
        'Only structuralRole span may declare a supported surface.',
        '{kind:"none"}'
      );
      return null;
    }
    return { kind: 'none' };
  }
  if (
    value.kind !== 'supported-surface' ||
    !hasExactContractKeys(value, SUPPORTED_SURFACE_KEYS)
  ) {
    addIssue(
      issues,
      path,
      'StructuralRole span requires the closed supported-surface contract.',
      '{kind:"supported-surface",obligationId,rootPartIds,spars,membranes}'
    );
    return null;
  }
  if (!isCanonicalAuthoringSlotId(value.obligationId)) {
    addIssue(
      issues,
      `${path}.obligationId`,
      'Supported surface requires a stable upstream obligation ID.',
      'canonical ID from intent.semanticContract.supportedSurfaces'
    );
    return null;
  }
  const owned = new Set(partIds ?? []);
  const rootPartIds = readOwnedPartIds(
    value.rootPartIds,
    `${path}.rootPartIds`,
    owned,
    issues
  );
  const spars = readSpars(value.spars, `${path}.spars`, owned, issues);
  const membranes = spars
    ? readMembranes(
        value.membranes,
        `${path}.membranes`,
        owned,
        new Set(spars.map((spar) => spar.sparId)),
        issues
      )
    : null;
  if (!partIds || !rootPartIds || !spars || !membranes) return null;
  const semanticIds = [
    ...spars.map((spar) => spar.sparId),
    ...membranes.map((membrane) => membrane.membraneId)
  ];
  if (new Set(semanticIds).size !== semanticIds.length) {
    addIssue(
      issues,
      path,
      'Span spar and membrane semantic IDs must be globally unique.',
      'unique semantic IDs across spars and membranes'
    );
    return null;
  }
  if (!validateExhaustiveRegions(
    partIds,
    rootPartIds,
    spars,
    membranes,
    path,
    issues
  )) {
    return null;
  }
  return {
    kind: 'supported-surface',
    obligationId: value.obligationId,
    rootPartIds,
    spars,
    membranes
  };
};
