import {
  hasExactContractKeys,
  isCurrentInternalContractVersion,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import {
  ARCHETYPE_IDS,
  AUTHORING_STRUCTURAL_ROLES,
  SPECIALIST_IDS,
  type ArchetypeDefinition,
  type SpecialistDefinition
} from './authoringTypes';
import {
  AUTHORING_DEFINITION_KEYS,
  allowedArchetypeIds,
  allowedCapabilities,
  allowedFacets,
  allowedPartKinds,
  allowedPortTypes,
  allowedQualityStages,
  allowedSpecialistIds,
  allowedStructuralRoles,
  duplicateValues,
  validCardinality,
  validateClause,
  validateClauseContradictions,
  validateEvidenceCriteria,
  validateReviewChecks,
  type AuthoringCatalogIssue
} from './authoringCatalogRules';

const validateAuthorityTextAndTaxonomy = (
  definition: ArchetypeDefinition | SpecialistDefinition,
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
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
};

const validateStructuralRolePolicies = (
  definition: ArchetypeDefinition,
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
  const roles = definition.structuralRolePolicies.map(
    (policy) => policy.role
  );
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
    if (
      !hasExactContractKeys(
        policy,
        AUTHORING_DEFINITION_KEYS.structuralRolePolicy
      )
    ) {
      issues.push({
        code: 'authoring.catalog.role_policy_shape_invalid',
        path: policyPath,
        message: 'Structural role policy must use the closed contract shape.'
      });
    }
    if (
      !allowedStructuralRoles.has(policy.role) ||
      policy.acceptedPartKinds.length === 0 ||
      policy.acceptedPartKinds.some((kind) =>
        !allowedPartKinds.has(kind)
      ) ||
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
};

const validateAttachmentPorts = (
  definition: ArchetypeDefinition,
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
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
    if (
      !Number.isSafeInteger(port.capacity) ||
      port.capacity < 1 ||
      port.capacity > 64
    ) {
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
};

const validateArchetypeDefinition = (
  definition: ArchetypeDefinition,
  index: number,
  issues: AuthoringCatalogIssue[]
): void => {
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
  validateAuthorityTextAndTaxonomy(definition, path, issues);
  validateStructuralRolePolicies(definition, path, issues);
  validateAttachmentPorts(definition, path, issues);
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
};

const validateSpecialistAttachments = (
  definition: SpecialistDefinition,
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
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
    if (
      !hasExactContractKeys(
        contribution,
        AUTHORING_DEFINITION_KEYS.contribution
      )
    ) {
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
};

const validateMotionRequirements = (
  definition: SpecialistDefinition,
  path: string,
  issues: AuthoringCatalogIssue[]
): void => {
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
};

const validateSpecialistDefinition = (
  definition: SpecialistDefinition,
  index: number,
  issues: AuthoringCatalogIssue[]
): void => {
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
  validateAuthorityTextAndTaxonomy(definition, path, issues);
  validateSpecialistAttachments(definition, path, issues);
  validateMotionRequirements(definition, path, issues);
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
};

const validateCatalogIdentity = (
  archetypes: readonly ArchetypeDefinition[],
  specialists: readonly SpecialistDefinition[],
  issues: AuthoringCatalogIssue[]
): void => {
  const archetypeIds = new Set(archetypes.map((entry) => entry.id));
  const specialistIds = new Set(specialists.map((entry) => entry.id));
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
  for (const id of duplicateValues(archetypes.map((entry) => entry.id))) {
    issues.push({
      code: 'authoring.catalog.id_duplicated',
      path: 'archetypes',
      message: `Duplicate archetype ID "${id}".`
    });
  }
  for (const id of duplicateValues(specialists.map((entry) => entry.id))) {
    issues.push({
      code: 'authoring.catalog.id_duplicated',
      path: 'specialists',
      message: `Duplicate specialist ID "${id}".`
    });
  }
};

const validateCapabilityDependencies = (
  archetypes: readonly ArchetypeDefinition[],
  specialists: readonly SpecialistDefinition[],
  issues: AuthoringCatalogIssue[]
): void => {
  const archetypeCapabilities = new Set(
    archetypes.flatMap((definition) => definition.capabilities)
  );
  const requirementsBySpecialist = new Map(
    specialists.map((definition) => [
      definition.id,
      definition.compatibility.flatMap((clause) =>
        clause.op === 'provides-capability' ? [clause.capability] : []
      )
    ])
  );
  const providersByCapability = new Map<string, string[]>();
  for (const specialist of specialists) {
    for (const capability of specialist.capabilities) {
      const providers = providersByCapability.get(capability) ?? [];
      providers.push(specialist.id);
      providersByCapability.set(capability, providers);
    }
  }
  const dependencyGraph = new Map<string, readonly string[]>();
  for (const specialist of specialists) {
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
  for (const specialist of specialists) visit(specialist.id);
};

const validateTypedAuthoringCatalog = (
  archetypes: readonly ArchetypeDefinition[],
  specialists: readonly SpecialistDefinition[]
): readonly AuthoringCatalogIssue[] => {
  const issues: AuthoringCatalogIssue[] = [];
  validateCatalogIdentity(archetypes, specialists, issues);
  archetypes.forEach((entry, index) =>
    validateArchetypeDefinition(entry, index, issues)
  );
  specialists.forEach((entry, index) =>
    validateSpecialistDefinition(entry, index, issues)
  );
  const contributionIds = specialists.flatMap((definition) =>
    definition.contributions.map((entry) => entry.id)
  );
  for (const id of duplicateValues(contributionIds)) {
    issues.push({
      code: 'authoring.catalog.contribution_duplicated',
      path: 'specialists',
      message: `Contribution ID "${id}" is not globally unique.`
    });
  }
  validateCapabilityDependencies(archetypes, specialists, issues);
  return issues;
};

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
    return validateTypedAuthoringCatalog(
      archetypes as readonly ArchetypeDefinition[],
      specialists as readonly SpecialistDefinition[]
    );
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
