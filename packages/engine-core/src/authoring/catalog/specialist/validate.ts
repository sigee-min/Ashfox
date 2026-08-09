import {
  hasExactContractKeys,
  isCurrentInternalContractVersion
} from '@ashfox/internal-contracts';

import { validateAuthorityTextAndTaxonomy } from '../authority';
import {
  AUTHORING_DEFINITION_KEYS,
  allowedSpecialistIds,
  validateClause,
  validateClauseContradictions,
  validateEvidenceCriteria,
  validateReviewChecks
} from '../rules';
import {
  validateMotionRequirements,
  validateSpecialistAttachments
} from '../contributions';
import type {
  AuthoringCatalogIssue,
  SpecialistDefinition
} from '../contract';

export const validateSpecialistDefinition = (
  definition: SpecialistDefinition,
  index: number
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  const path = `specialists[${index}]`;
  if (!hasExactContractKeys(definition, AUTHORING_DEFINITION_KEYS.specialist)) {
    issues.push({
      code: 'authoring.catalog.specialist_shape_invalid',
      path,
      message: 'Specialist must use the closed contract definition shape.'
    });
  }
  if (!allowedSpecialistIds.has(definition.id)) {
    issues.push({
      code: 'authoring.catalog.id_unknown',
      path: `${path}.id`,
      message: `Unknown specialist ID "${definition.id}".`
    });
  }
  if (!isCurrentInternalContractVersion('authoringProfile', definition.version)) {
    issues.push({
      code: 'authoring.catalog.version_invalid',
      path: `${path}.version`,
      message: 'Specialist must declare the current explicit version.'
    });
  }
  if ('kind' in definition) {
    issues.push({
      code: 'authoring.catalog.specialist_kind_forbidden',
      path: `${path}.kind`,
      message: 'Specialists cannot declare a kind classification.'
    });
  }
  if ('attachmentPorts' in definition) {
    issues.push({
      code: 'authoring.catalog.specialist_port_forbidden',
      path: `${path}.attachmentPorts`,
      message: 'Only archetypes may provide attachment ports.'
    });
  }
  issues.push(...validateAuthorityTextAndTaxonomy(definition, path));
  issues.push(...validateSpecialistAttachments(definition, path));
  issues.push(...validateMotionRequirements(definition, path));
  definition.compatibility.forEach((clause, clauseIndex) =>
    validateClause(clause, `${path}.compatibility[${clauseIndex}]`, issues)
  );
  validateClauseContradictions(
    [...definition.attachmentRequirements, ...definition.compatibility],
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
