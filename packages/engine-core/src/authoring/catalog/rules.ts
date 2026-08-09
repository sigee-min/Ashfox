import {
  hasExactContractKeys,
  isClosedContractRecord,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import {
  ARCHETYPE_IDS,
  ATTACHMENT_PORT_TYPES,
  AUTHORING_CAPABILITIES,
  AUTHORING_FACETS,
  AUTHORING_PART_KINDS,
  AUTHORING_QUALITY_STAGES,
  AUTHORING_REVIEW_CAMERAS,
  AUTHORING_REVIEW_ISSUES,
  AUTHORING_STRUCTURAL_ROLES,
  SPECIALIST_IDS
} from '../contract';
import type {
  ArchetypeDefinition,
  AuthoringCatalogIssue,
  CompatibilityClause,
  CompatibilityCollectionPath,
  CompatibilityScalarPath,
  SpecialistDefinition
} from './contract';

const scalarPaths = new Set<CompatibilityScalarPath>([
  'routing.animationSupported'
]);
const collectionPaths = new Set<CompatibilityCollectionPath>([
  'selection.specialistIds'
]);

export const allowedArchetypeIds = new Set<string>(ARCHETYPE_IDS);
export const allowedSpecialistIds = new Set<string>(SPECIALIST_IDS);
export const allowedFacets = new Set<string>(AUTHORING_FACETS);
export const allowedCapabilities = new Set<string>(AUTHORING_CAPABILITIES);
export const allowedPortTypes = new Set<string>(ATTACHMENT_PORT_TYPES);
export const allowedPartKinds = new Set<string>(AUTHORING_PART_KINDS);
export const allowedStructuralRoles = new Set<string>(
  AUTHORING_STRUCTURAL_ROLES
);
export const allowedQualityStages = new Set<string>(
  AUTHORING_QUALITY_STAGES
);
const allowedReviewCameras = new Set<string>(AUTHORING_REVIEW_CAMERAS);
const allowedReviewIssues = new Set<string>(AUTHORING_REVIEW_ISSUES);

export const AUTHORING_DEFINITION_KEYS = Object.freeze({
  archetype: new Set([
    'id',
    'version',
    'label',
    'summary',
    'useWhen',
    'instruction',
    'facets',
    'capabilities',
    'evidenceCriteria',
    'structuralRolePolicies',
    'attachmentPorts',
    'compatibility',
    'reviewChecks'
  ]),
  specialist: new Set([
    'id',
    'version',
    'label',
    'summary',
    'useWhen',
    'instruction',
    'facets',
    'capabilities',
    'evidenceCriteria',
    'attachmentRequirements',
    'contributions',
    'bindingRequirements',
    'compatibility',
    'reviewChecks'
  ]),
  structuralRolePolicy: new Set([
    'role',
    'acceptedPartKinds',
    'allowedQualityStages',
    'instruction'
  ]),
  contribution: new Set([
    'id',
    'label',
    'acceptedPartKinds',
    'instruction',
    'required',
    'minParts',
    'maxParts',
    'attachmentRequirementId'
  ]),
  port: new Set([
    'id',
    'type',
    'hostStructuralRoles',
    'capacity',
    'acceptsFacets'
  ]),
  review: new Set(['id', 'facets', 'cameras', 'issue', 'instruction']),
  motionBinding: new Set([
    'type',
    'allowedRoles',
    'minBindings',
    'maxBindings'
  ]),
  evidenceCriterion: new Set(['id', 'basis', 'required', 'instruction'])
});

export const validateClause = (
  value: unknown,
  path: string,
  issues: AuthoringCatalogIssue[]
): value is CompatibilityClause => {
  if (!isClosedContractRecord(value) || typeof value.op !== 'string') {
    issues.push({
      code: 'authoring.catalog.clause_invalid',
      path,
      message: 'Compatibility clause must be a closed declarative object.'
    });
    return false;
  }
  if (value.op === 'equals') {
    const shapeInvalid =
      !hasExactContractKeys(value, new Set(['op', 'path', 'value'])) ||
      typeof value.path !== 'string' ||
      !scalarPaths.has(value.path as CompatibilityScalarPath);
    const valueValid = value.path === 'routing.animationSupported' &&
      typeof value.value === 'boolean';
    if (shapeInvalid || !valueValid) {
      issues.push({
        code: 'authoring.catalog.clause_invalid',
        path,
        message: 'Invalid equals clause.'
      });
      return false;
    }
    return true;
  }
  if (value.op === 'forbids') {
    const shapeInvalid =
      !hasExactContractKeys(value, new Set(['op', 'path', 'value'])) ||
      typeof value.path !== 'string' ||
      !collectionPaths.has(value.path as CompatibilityCollectionPath) ||
      !isNonEmptyContractText(value.value);
    const valueValid = value.path === 'selection.specialistIds' &&
      allowedSpecialistIds.has(String(value.value));
    if (shapeInvalid || !valueValid) {
      issues.push({
        code: 'authoring.catalog.clause_invalid',
        path,
      message: 'Invalid forbids clause.'
      });
      return false;
    }
    return true;
  }
  if (value.op === 'requires-port') {
    if (
      !hasExactContractKeys(
        value,
        new Set(['op', 'requirementId', 'portType'])
      ) ||
      !isNonEmptyContractText(value.requirementId) ||
      !isNonEmptyContractText(value.portType) ||
      !allowedPortTypes.has(value.portType)
    ) {
      issues.push({
        code: 'authoring.catalog.clause_invalid',
        path,
        message: 'Invalid requires-port clause.'
      });
      return false;
    }
    return true;
  }
  if (value.op === 'provides-capability') {
    if (
      !hasExactContractKeys(value, new Set(['op', 'capability'])) ||
      !isNonEmptyContractText(value.capability) ||
      !allowedCapabilities.has(value.capability)
    ) {
      issues.push({
        code: 'authoring.catalog.clause_invalid',
        path,
        message: 'Invalid provides-capability clause.'
      });
      return false;
    }
    return true;
  }
  issues.push({
    code: 'authoring.catalog.clause_invalid',
    path,
    message: `Unknown compatibility operator "${value.op}".`
  });
  return false;
};

export const duplicateValues = (
  values: readonly string[]
): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

export const validCardinality = (
  minimum: number,
  maximum: number
): boolean =>
  Number.isSafeInteger(minimum) &&
  Number.isSafeInteger(maximum) &&
  minimum >= 0 &&
  maximum >= minimum &&
  maximum <= 64;

export const validateReviewChecks = (
  checks: readonly ArchetypeDefinition['reviewChecks'][number][],
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
  for (const [index, check] of checks.entries()) {
    const checkPath = `${path}[${index}]`;
    if (!hasExactContractKeys(check, AUTHORING_DEFINITION_KEYS.review)) {
      issues.push({
        code: 'authoring.catalog.review_shape_invalid',
        path: checkPath,
        message: 'Review check must use the closed contract shape.'
      });
    }
    if (
      !isNonEmptyContractText(check.id) ||
      !isNonEmptyContractText(check.instruction) ||
      check.facets.length === 0 ||
      check.facets.some((facet) => !allowedFacets.has(facet)) ||
      check.cameras.length === 0 ||
      check.cameras.some((camera) => !allowedReviewCameras.has(camera)) ||
      !allowedReviewIssues.has(check.issue)
    ) {
      issues.push({
        code: 'authoring.catalog.review_value_invalid',
        path: checkPath,
        message: 'Review check contains an unknown or empty value.'
      });
    }
  }
};

export const validateEvidenceCriteria = (
  criteria: readonly ArchetypeDefinition['evidenceCriteria'][number][],
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
  if (criteria.length === 0) {
    issues.push({
      code: 'authoring.catalog.evidence_criteria_missing',
      path,
      message: 'Every authority must declare at least one evidence criterion.'
    });
    return;
  }
  for (const id of duplicateValues(criteria.map((entry) => entry.id))) {
    issues.push({
      code: 'authoring.catalog.evidence_criterion_duplicated',
      path,
      message: `Duplicate evidence criterion "${id}".`
    });
  }
  criteria.forEach((criterion, index) => {
    const criterionPath = `${path}[${index}]`;
    if (
      !hasExactContractKeys(
        criterion,
        AUTHORING_DEFINITION_KEYS.evidenceCriterion
      ) ||
      !isNonEmptyContractText(criterion.id) ||
      !['observed', 'requested', 'either'].includes(criterion.basis) ||
      typeof criterion.required !== 'boolean' ||
      !isNonEmptyContractText(criterion.instruction)
    ) {
      issues.push({
        code: 'authoring.catalog.evidence_criterion_invalid',
        path: criterionPath,
        message: 'Evidence criterion must use the closed contract taxonomy and shape.'
      });
    }
  });
};

export const slotGraphHasCycle = (
  slots: readonly {
    slotId: string;
    parentSlotIds: readonly string[];
  }[]
): boolean => {
  const parents = new Map(
    slots.map((slot) => [slot.slotId, slot.parentSlotIds])
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((parents.get(id) ?? []).some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...parents.keys()].some(visit);
};

export const validateClauseContradictions = (
  clauses: readonly CompatibilityClause[],
  authority: ArchetypeDefinition | SpecialistDefinition,
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
  const equalsByPath = new Map<string, string>();
  for (const clause of clauses) {
    if (clause.op === 'equals') {
      const serialized = JSON.stringify(clause.value);
      const prior = equalsByPath.get(clause.path);
      if (prior !== undefined && prior !== serialized) {
        issues.push({
          code: 'authoring.catalog.clause_contradiction',
          path,
          message: `The catalog requires conflicting values at "${clause.path}".`
        });
      }
      equalsByPath.set(clause.path, serialized);
    }
    if (
      clause.op === 'forbids' &&
      clause.path === 'selection.specialistIds' &&
      authority.id === clause.value
    ) {
      issues.push({
        code: 'authoring.catalog.clause_contradiction',
        path,
        message: `Specialist "${authority.id}" forbids itself.`
      });
    }
  }
};
