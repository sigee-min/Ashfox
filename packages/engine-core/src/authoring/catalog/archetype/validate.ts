import {
  hasExactContractKeys,
  isCurrentInternalContractVersion,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import { validateAuthorityTextAndTaxonomy } from '../authority';
import {
  AUTHORING_DEFINITION_KEYS,
  allowedArchetypeIds,
  allowedFacets,
  allowedPartKinds,
  allowedPortTypes,
  allowedQualityStages,
  allowedStructuralRoles,
  duplicateValues,
  validateClause,
  validateClauseContradictions,
  validateEvidenceCriteria,
  validateReviewChecks
} from '../rules';
import { AUTHORING_STRUCTURAL_ROLES } from '../../contract';
import type {
  ArchetypeDefinition,
  AuthoringCatalogIssue
} from '../contract';

const validateStructuralRolePolicies = (
  definition: ArchetypeDefinition,
  path: string
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  const roles = definition.structuralRolePolicies.map((policy) => policy.role);
  for (const role of duplicateValues(roles)) {
    issues.push({
      code: 'authoring.catalog.role_policy_duplicated',
      path: `${path}.structuralRolePolicies`,
      message: `Duplicate structural role policy "${role}".`
    });
  }
  for (const role of AUTHORING_STRUCTURAL_ROLES) {
    if (!roles.includes(role)) {
      issues.push({
        code: 'authoring.catalog.role_policy_missing',
        path: `${path}.structuralRolePolicies`,
        message: `Missing structural role policy "${role}".`
      });
    }
  }
  definition.structuralRolePolicies.forEach((policy, index) => {
    const policyPath = `${path}.structuralRolePolicies[${index}]`;
    if (!hasExactContractKeys(
      policy,
      AUTHORING_DEFINITION_KEYS.structuralRolePolicy
    )) {
      issues.push({
        code: 'authoring.catalog.role_policy_shape_invalid',
        path: policyPath,
        message: 'Structural role policy must use the closed contract shape.'
      });
    }
    if (
      !allowedStructuralRoles.has(policy.role) ||
      policy.acceptedPartKinds.length === 0 ||
      policy.acceptedPartKinds.some((kind) => !allowedPartKinds.has(kind)) ||
      duplicateValues(policy.acceptedPartKinds).length > 0 ||
      policy.allowedQualityStages.length === 0 ||
      policy.allowedQualityStages.some((stage) =>
        !allowedQualityStages.has(stage)
      ) ||
      duplicateValues(policy.allowedQualityStages).length > 0 ||
      !isNonEmptyContractText(policy.instruction)
    ) {
      issues.push({
        code: 'authoring.catalog.role_policy_value_invalid',
        path: policyPath,
        message: 'Structural role policy contains an unknown or empty value.'
      });
    }
  });
  return issues;
};

const validateAttachmentPorts = (
  definition: ArchetypeDefinition,
  path: string
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  for (const id of duplicateValues(
    definition.attachmentPorts.map((port) => port.id)
  )) {
    issues.push({
      code: 'authoring.catalog.port_duplicated',
      path: `${path}.attachmentPorts`,
      message: `Duplicate attachment port "${id}".`
    });
  }
  definition.attachmentPorts.forEach((port, index) => {
    const portPath = `${path}.attachmentPorts[${index}]`;
    if (!hasExactContractKeys(port, AUTHORING_DEFINITION_KEYS.port)) {
      issues.push({
        code: 'authoring.catalog.port_shape_invalid',
        path: portPath,
        message: 'Attachment port must use the closed contract shape.'
      });
    }
    if (
      !isNonEmptyContractText(port.id) ||
      !allowedPortTypes.has(port.type) ||
      port.acceptsFacets.length === 0 ||
      port.acceptsFacets.some((facet) => !allowedFacets.has(facet))
    ) {
      issues.push({
        code: 'authoring.catalog.port_value_invalid',
        path: portPath,
        message: 'Attachment port contains an unknown or empty value.'
      });
    }
    if (!Number.isSafeInteger(port.capacity) ||
      port.capacity < 1 || port.capacity > 64) {
      issues.push({
        code: 'authoring.catalog.port_capacity_invalid',
        path: `${portPath}.capacity`,
        message: 'Port capacity must be a positive integer.'
      });
    }
    if (
      port.hostStructuralRoles.length === 0 ||
      port.hostStructuralRoles.some((role) =>
        !allowedStructuralRoles.has(role)
      ) ||
      duplicateValues(port.hostStructuralRoles).length > 0
    ) {
      issues.push({
        code: 'authoring.catalog.port_host_role_invalid',
        path: `${portPath}.hostStructuralRoles`,
        message: 'Every port host role must use the closed structural taxonomy.'
      });
    }
  });
  return issues;
};

export const validateArchetypeDefinition = (
  definition: ArchetypeDefinition,
  index: number
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  const path = `archetypes[${index}]`;
  if (!hasExactContractKeys(definition, AUTHORING_DEFINITION_KEYS.archetype)) {
    issues.push({
      code: 'authoring.catalog.archetype_shape_invalid',
      path,
      message: 'Archetype must use the closed contract definition shape.'
    });
  }
  if (!allowedArchetypeIds.has(definition.id)) {
    issues.push({
      code: 'authoring.catalog.id_unknown',
      path: `${path}.id`,
      message: `Unknown archetype ID "${definition.id}".`
    });
  }
  if (!isCurrentInternalContractVersion('authoringProfile', definition.version)) {
    issues.push({
      code: 'authoring.catalog.version_invalid',
      path: `${path}.version`,
      message: 'Archetype must declare the current explicit version.'
    });
  }
  issues.push(...validateAuthorityTextAndTaxonomy(definition, path));
  issues.push(...validateStructuralRolePolicies(definition, path));
  issues.push(...validateAttachmentPorts(definition, path));
  definition.compatibility.forEach((clause, clauseIndex) =>
    validateClause(clause, `${path}.compatibility[${clauseIndex}]`, issues)
  );
  validateClauseContradictions(
    definition.compatibility,
    definition,
    `${path}.compatibility`,
    issues
  );
  validateReviewChecks(definition.reviewChecks, `${path}.reviewChecks`, issues);
  validateEvidenceCriteria(
    definition.evidenceCriteria,
    `${path}.evidenceCriteria`,
    issues
  );
  return issues;
};
