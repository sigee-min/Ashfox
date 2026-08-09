import { validateArchetypeDefinition } from './archetype/validate';
import {
  duplicateValues
} from './rules';
import { validateSpecialistDefinition } from './specialist/validate';
import type {
  AuthoringCatalogIssue,
  AuthoringCatalogSnapshot,
  AuthoringCatalogValidationStage
} from './contract';
import { ARCHETYPE_IDS, SPECIALIST_IDS } from '../contract';

export const validateCatalogIdentity: AuthoringCatalogValidationStage = (
  catalog
) => {
  const issues: AuthoringCatalogIssue[] = [];
  const archetypeIds = new Set(catalog.archetypes.map((entry) => entry.id));
  const specialistIds = new Set(catalog.specialists.map((entry) => entry.id));
  for (const id of ARCHETYPE_IDS) {
    if (!archetypeIds.has(id)) {
      issues.push({
        code: 'authoring.catalog.definition_missing',
        path: 'archetypes',
        message: `Missing archetype definition "${id}".`
      });
    }
  }
  for (const id of SPECIALIST_IDS) {
    if (!specialistIds.has(id)) {
      issues.push({
        code: 'authoring.catalog.definition_missing',
        path: 'specialists',
        message: `Missing specialist definition "${id}".`
      });
    }
  }
  for (const id of duplicateValues(catalog.archetypes.map((entry) => entry.id))) {
    issues.push({
      code: 'authoring.catalog.id_duplicated',
      path: 'archetypes',
      message: `Duplicate archetype ID "${id}".`
    });
  }
  for (const id of duplicateValues(catalog.specialists.map((entry) => entry.id))) {
    issues.push({
      code: 'authoring.catalog.id_duplicated',
      path: 'specialists',
      message: `Duplicate specialist ID "${id}".`
    });
  }
  return issues;
};

export const validateCatalogDefinitions: AuthoringCatalogValidationStage = (
  catalog
) => {
  const issues = [
    ...catalog.archetypes.flatMap(validateArchetypeDefinition),
    ...catalog.specialists.flatMap(validateSpecialistDefinition)
  ];
  const contributionIds = catalog.specialists.flatMap((definition) =>
    definition.contributions.map((entry) => entry.id)
  );
  for (const id of duplicateValues(contributionIds)) {
    issues.push({
      code: 'authoring.catalog.contribution_duplicated',
      path: 'specialists',
      message: `Contribution ID "${id}" is not globally unique.`
    });
  }
  return issues;
};

export const validateCapabilityDependencies: AuthoringCatalogValidationStage = (
  catalog: AuthoringCatalogSnapshot
) => {
  const issues: AuthoringCatalogIssue[] = [];
  const archetypeCapabilities = new Set(
    catalog.archetypes.flatMap((definition) => definition.capabilities)
  );
  const requirementsBySpecialist = new Map(
    catalog.specialists.map((definition) => [
      definition.id,
      definition.compatibility.flatMap((clause) =>
        clause.op === 'provides-capability' ? [clause.capability] : []
      )
    ])
  );
  const providersByCapability = new Map<string, string[]>();
  for (const specialist of catalog.specialists) {
    for (const capability of specialist.capabilities) {
      providersByCapability.set(capability, [
        ...(providersByCapability.get(capability) ?? []),
        specialist.id
      ]);
    }
  }
  const dependencyGraph = new Map<string, readonly string[]>();
  for (const specialist of catalog.specialists) {
    const requirements = requirementsBySpecialist.get(specialist.id) ?? [];
    const dependencies = requirements
      .filter((capability) => !archetypeCapabilities.has(capability))
      .flatMap((capability) => providersByCapability.get(capability) ?? [])
      .filter((provider) => provider !== specialist.id);
    dependencyGraph.set(specialist.id, dependencies);
    for (const capability of requirements) {
      const otherProvider = archetypeCapabilities.has(capability) ||
        (providersByCapability.get(capability) ?? [])
          .some((provider) => provider !== specialist.id);
      if (!otherProvider) {
        issues.push({
          code: 'authoring.catalog.capability_self_satisfying',
          path: `specialists.${specialist.id}.compatibility`,
          message:
            `Capability requirement "${capability}" can only be ` +
            'satisfied by its owner.'
        });
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push({
        code: 'authoring.catalog.capability_cycle',
        path: 'specialists',
        message: `Capability dependency cycle includes "${id}".`
      });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencyGraph.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const specialist of catalog.specialists) visit(specialist.id);
  return issues;
};
