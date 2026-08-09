import { isNonEmptyContractText } from '@ashfox/internal-contracts';

import {
  allowedCapabilities,
  allowedFacets,
  duplicateValues
} from './rules';
import type {
  ArchetypeDefinition,
  AuthoringCatalogIssue,
  SpecialistDefinition
} from './contract';

export const validateAuthorityTextAndTaxonomy = (
  definition: ArchetypeDefinition | SpecialistDefinition,
  path: string
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  if (
    !isNonEmptyContractText(definition.label) ||
    !isNonEmptyContractText(definition.summary) ||
    !isNonEmptyContractText(definition.useWhen) ||
    !isNonEmptyContractText(definition.instruction)
  ) {
    issues.push({
      code: 'authoring.catalog.text_invalid',
      path,
      message: 'Authority descriptive text must be non-empty canonical text.'
    });
  }
  if (
    definition.facets.some((facet) => !allowedFacets.has(facet)) ||
    definition.capabilities.some((entry) => !allowedCapabilities.has(entry))
  ) {
    issues.push({
      code: 'authoring.catalog.taxonomy_invalid',
      path,
      message: 'Authority uses a facet or capability outside the closed taxonomy.'
    });
  }
  if (
    duplicateValues(definition.facets).length > 0 ||
    duplicateValues(definition.capabilities).length > 0
  ) {
    issues.push({
      code: 'authoring.catalog.taxonomy_duplicated',
      path,
      message: 'Authority facets and capabilities must be unique sets.'
    });
  }
  return issues;
};
