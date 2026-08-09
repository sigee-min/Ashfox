import {
  validateCapabilityDependencies,
  validateCatalogDefinitions,
  validateCatalogIdentity
} from './stages';
import type {
  ArchetypeDefinition,
  AuthoringCatalogIssue,
  AuthoringCatalogSnapshot,
  AuthoringCatalogValidationStage,
  SpecialistDefinition
} from './contract';

const VALIDATION_STAGES: readonly AuthoringCatalogValidationStage[] = [
  validateCatalogIdentity,
  validateCatalogDefinitions,
  validateCapabilityDependencies
];

const validateTypedAuthoringCatalog = (
  catalog: AuthoringCatalogSnapshot
): readonly AuthoringCatalogIssue[] =>
  VALIDATION_STAGES.flatMap((stage) => stage(catalog));

export const validateAuthoringCatalog = (
  archetypes: unknown,
  specialists: unknown
): readonly AuthoringCatalogIssue[] => {
  if (!Array.isArray(archetypes) || !Array.isArray(specialists)) {
    return [{
      code: 'authoring.catalog.root_shape_invalid',
      path: 'catalog',
      message: 'Authoring catalog roots must both be arrays.'
    }];
  }
  try {
    return validateTypedAuthoringCatalog({
      archetypes: archetypes as readonly ArchetypeDefinition[],
      specialists: specialists as readonly SpecialistDefinition[]
    });
  } catch (error) {
    return [{
      code: 'authoring.catalog.malformed_value',
      path: 'catalog',
      message:
        'Authoring catalog contains a malformed nested value: ' +
        `${error instanceof Error ? error.message : String(error)}`
    }];
  }
};
