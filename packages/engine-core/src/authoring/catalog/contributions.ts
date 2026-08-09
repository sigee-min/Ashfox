import {
  hasExactContractKeys,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import {
  AUTHORING_DEFINITION_KEYS,
  allowedPartKinds,
  duplicateValues,
  validCardinality,
  validateClause
} from './rules';
import type {
  AuthoringCatalogIssue,
  SpecialistDefinition
} from './contract';

export const validateSpecialistAttachments = (
  definition: SpecialistDefinition,
  path: string
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  const requirementIds = new Set(
    definition.attachmentRequirements.map((entry) => entry.requirementId)
  );
  for (const id of duplicateValues(
    definition.attachmentRequirements.map((entry) => entry.requirementId)
  )) {
    issues.push({
      code: 'authoring.catalog.requirement_duplicated',
      path: `${path}.attachmentRequirements`,
      message: `Duplicate attachment requirement "${id}".`
    });
  }
  definition.attachmentRequirements.forEach((clause, index) => {
    const clausePath = `${path}.attachmentRequirements[${index}]`;
    if (clause.op !== 'requires-port') {
      issues.push({
        code: 'authoring.catalog.clause_invalid',
        path: clausePath,
        message: 'Attachment requirements may only require a port.'
      });
    }
    validateClause(clause, clausePath, issues);
  });
  definition.contributions.forEach((contribution, index) => {
    const contributionPath = `${path}.contributions[${index}]`;
    if (!hasExactContractKeys(
      contribution,
      AUTHORING_DEFINITION_KEYS.contribution
    )) {
      issues.push({
        code: 'authoring.catalog.contribution_shape_invalid',
        path: contributionPath,
        message: 'Contribution must use the topology-free contract shape.'
      });
    }
    if (
      !isNonEmptyContractText(contribution.id) ||
      !isNonEmptyContractText(contribution.label) ||
      !isNonEmptyContractText(contribution.instruction) ||
      typeof contribution.required !== 'boolean' ||
      contribution.acceptedPartKinds.length === 0 ||
      contribution.acceptedPartKinds.some((kind) =>
        !allowedPartKinds.has(kind)
      ) ||
      !validCardinality(contribution.minParts, contribution.maxParts)
    ) {
      issues.push({
        code: 'authoring.catalog.contribution_value_invalid',
        path: contributionPath,
        message: 'Contribution contains an unknown or invalid value.'
      });
    }
    if (!requirementIds.has(contribution.attachmentRequirementId)) {
      issues.push({
        code: 'authoring.catalog.contribution_requirement_missing',
        path: `${contributionPath}.attachmentRequirementId`,
        message:
          `Contribution requirement ` +
          `"${contribution.attachmentRequirementId}" is not declared.`
      });
    }
  });
  for (const requirementId of requirementIds) {
    const bound = definition.contributions.some((entry) =>
      entry.attachmentRequirementId === requirementId
    );
    if (!bound) {
      issues.push({
        code: 'authoring.catalog.requirement_unbound',
        path: `${path}.attachmentRequirements`,
        message: `Attachment requirement "${requirementId}" has no contribution.`
      });
    }
  }
  return issues;
};

export const validateMotionRequirements = (
  definition: SpecialistDefinition,
  path: string
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  if (definition.bindingRequirements.length > 1) {
    issues.push({
      code: 'authoring.catalog.binding_requirement_duplicated',
      path: `${path}.bindingRequirements`,
      message: 'A specialist may declare at most one motion requirement.'
    });
  }
  definition.bindingRequirements.forEach((requirement, index) => {
    const bindingPath = `${path}.bindingRequirements[${index}]`;
    if (
      !hasExactContractKeys(
        requirement,
        AUTHORING_DEFINITION_KEYS.motionBinding
      ) ||
      requirement.type !== 'motion' ||
      requirement.allowedRoles.length === 0 ||
      requirement.allowedRoles.some((role) =>
        !['idle', 'loop', 'once'].includes(role)
      ) ||
      !validCardinality(requirement.minBindings, requirement.maxBindings)
    ) {
      issues.push({
        code: 'authoring.catalog.binding_requirement_invalid',
        path: bindingPath,
        message: 'Binding requirement must use the bounded motion shape.'
      });
    }
  });
  return issues;
};
