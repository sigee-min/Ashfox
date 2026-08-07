import { evaluateAuthoringBindings } from './authoringBindingEvaluator';
import { authoringCompatibilityIssue as issue } from './authoringIssueFactories';
import {
  resolveArchetypeReference,
  resolveSpecialistReference
} from './authoringRegistry';
import {
  type ArchetypeDefinition,
  type AuthoringAuthorityReference,
  type AuthoringCompatibilityIssue,
  type AuthoringCompatibilityResult,
  type AuthoringProfile,
  type CompatibilityClause,
  type CompatibilityCollectionPath,
  type CompatibilityScalarPath,
  type SpecialistDefinition
} from './authoringTypes';

export {
  validateAuthoringCatalog
} from './authoringCatalogValidator';
export type {
  AuthoringCatalogIssue
} from './authoringCatalogRules';

interface EvaluationContext {
  scalars: Readonly<Record<CompatibilityScalarPath, boolean>>;
  collections: Readonly<Record<
    CompatibilityCollectionPath,
    ReadonlySet<string>
  >>;
  archetypePortTypes: ReadonlySet<string>;
  capabilitiesByAuthority: ReadonlyMap<string, ReadonlySet<string>>;
}

const evaluateClause = (
  clause: CompatibilityClause,
  owner: AuthoringAuthorityReference,
  context: EvaluationContext,
  path: string
): AuthoringCompatibilityIssue | null => {
  switch (clause.op) {
    case 'equals':
      return context.scalars[clause.path] === clause.value
        ? null
        : issue(
            'authoring.compatibility.equals_failed',
            path,
            `Compatibility value at "${clause.path}" does not equal the required value.`,
            JSON.stringify(clause.value),
            owner
          );
    case 'forbids':
      return context.collections[clause.path].has(clause.value)
        ? issue(
            'authoring.compatibility.forbidden_value',
            path,
            `Compatibility collection "${clause.path}" contains forbidden value "${clause.value}".`,
            `selection without ${clause.value}`,
            owner
          )
        : null;
    case 'requires-port':
      return context.archetypePortTypes.has(clause.portType)
        ? null
        : issue(
            'authoring.compatibility.port_type_missing',
            path,
            `The archetype does not provide required port type "${clause.portType}".`,
            clause.portType,
            owner
          );
    case 'provides-capability': {
      const providedOutsideOwner = [...context.capabilitiesByAuthority]
        .some(([authorityId, capabilities]) =>
          authorityId !== owner.id && capabilities.has(clause.capability)
        );
      return providedOutsideOwner
        ? null
        : issue(
            'authoring.compatibility.capability_missing',
            path,
            `No other selected authority provides capability "${clause.capability}".`,
            clause.capability,
            owner
          );
    }
  }
};

export const evaluateAuthoringCompatibility = (
  profile: AuthoringProfile
): AuthoringCompatibilityResult => {
  const issues: AuthoringCompatibilityIssue[] = [];
  const archetype = resolveArchetypeReference(profile.archetype);
  if (!archetype) {
    issues.push(issue(
      'authoring.compatibility.archetype_unknown',
      'archetype',
      `Archetype reference "${profile.archetype.id}" is not current.`,
      'a registered explicit v2 archetype reference'
    ));
    return { compatible: false, issues };
  }
  const selectedSpecialists: SpecialistDefinition[] = [];
  profile.specialists.forEach((reference, index) => {
    const definition = resolveSpecialistReference(reference);
    if (!definition) {
      issues.push(issue(
        'authoring.compatibility.specialist_unknown',
        `specialists[${index}]`,
        `Specialist reference "${reference.id}" is not current.`,
        'a registered explicit v2 specialist reference'
      ));
      return;
    }
    selectedSpecialists.push(definition);
  });
  if (issues.length > 0) return { compatible: false, issues };

  const capabilitiesByAuthority = new Map<string, ReadonlySet<string>>([
    [archetype.id, new Set(archetype.capabilities)],
    ...selectedSpecialists.map((definition) => [
      definition.id,
      new Set(definition.capabilities)
    ] as const)
  ]);
  const context: EvaluationContext = {
    scalars: {
      'routing.animationSupported': profile.routing.animationSupported
    },
    collections: {
      'selection.specialistIds': new Set(
        selectedSpecialists.map((definition) => definition.id)
      )
    },
    archetypePortTypes: new Set(
      archetype.attachmentPorts.map((port) => port.type)
    ),
    capabilitiesByAuthority
  };
  const authorities: readonly {
    definition: ArchetypeDefinition | SpecialistDefinition;
    clauses: readonly CompatibilityClause[];
    path: string;
  }[] = [
    {
      definition: archetype,
      clauses: archetype.compatibility,
      path: 'archetype'
    },
    ...selectedSpecialists.map((definition, index) => ({
      definition,
      clauses: [
        ...definition.attachmentRequirements,
        ...definition.compatibility
      ],
      path: `specialists[${index}]`
    }))
  ];
  for (const authority of authorities) {
    const reference: AuthoringAuthorityReference = {
      id: authority.definition.id,
      version: authority.definition.version
    };
    authority.clauses.forEach((clause, index) => {
      const finding = evaluateClause(
        clause,
        reference,
        context,
        `${authority.path}.compatibility[${index}]`
      );
      if (finding) issues.push(finding);
    });
  }
  issues.push(
    ...evaluateAuthoringBindings(profile, archetype, selectedSpecialists)
  );
  return { compatible: issues.length === 0, issues };
};
