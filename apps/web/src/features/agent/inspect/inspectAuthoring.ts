import {
  evaluateAuthoringCompatibility,
  evaluateAuthoringPlan,
  getArchetype,
  getAuthoringRecipe,
  getSpecialist,
  listArchetypes,
  listAuthoringRecipes,
  listSpecialists,
  type ProjectDocument
} from '@ashfox/engine-core';

import { boundedSuccess } from '../boundedResult';
import type { InspectResult } from '../types';
import { DETAIL_INSPECT_LIMIT } from './inspectResult';
import {
  authoringPlanProjection,
  authoringProfileProjection
} from './authoringPlanProjection';

const evidenceFor = (
  document: ProjectDocument,
  id?: string
) => (document.authoringProfile?.claims ?? [])
  .filter((claim) => id === undefined || claim.authority.id === id)
  .map((claim) => ({
    authority: claim.authority,
    criterionId: claim.criterionId,
    basis: claim.basis,
    referenceIds: claim.referenceIds,
    rationale: claim.rationale
  }));

export const inspectAuthoring = (
  document: ProjectDocument,
  id?: string
): InspectResult => {
  const plan = evaluateAuthoringPlan(document);
  const profile = document.authoringProfile ?? null;
  const compatibility = profile
    ? evaluateAuthoringCompatibility(profile)
    : null;
  const archetypes = listArchetypes();
  const specialists = listSpecialists();
  if (id !== undefined) {
    const archetype = getArchetype(id);
    if (archetype) {
      return boundedSuccess(
        document.revision,
        {
          authority: {
            type: 'archetype',
            definition: archetype,
            selected: profile?.archetype.id === archetype.id,
            evidence: evidenceFor(document, archetype.id),
            compatibility
          }
        },
        DETAIL_INSPECT_LIMIT
      );
    }
    const specialist = getSpecialist(id);
    if (specialist) {
      return boundedSuccess(
        document.revision,
        {
          authority: {
            type: 'specialist',
            definition: specialist,
            selected: profile?.specialists.some(
              (reference) => reference.id === specialist.id
            ) === true,
            evidence: evidenceFor(document, specialist.id),
            compatibility
          }
        },
        DETAIL_INSPECT_LIMIT
      );
    }
    const recipe = getAuthoringRecipe(id);
    if (recipe) {
      return boundedSuccess(
        document.revision,
        {
          guidance: {
            authoritative: false,
            role: 'non-authoritative',
            recipe
          }
        },
        DETAIL_INSPECT_LIMIT
      );
    }
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'not_found',
        path: 'id',
        expected:
          'registered structural authority, specialist, or authoring recipe ID'
      }
    };
  }
  return boundedSuccess(
    document.revision,
    {
      authority: {
        profile: authoringProfileProjection(profile),
        evidence: evidenceFor(document),
        compatibility,
        plan: authoringPlanProjection(plan)
      },
      catalog: profile === null
        ? {
          archetypes: archetypes.map((archetype) => ({
          id: archetype.id,
          version: archetype.version,
          label: archetype.label,
          summary: archetype.summary,
          facets: archetype.facets,
          capabilities: archetype.capabilities,
          evidenceCriteria: archetype.evidenceCriteria.map((criterion) => ({
            id: criterion.id,
            basis: criterion.basis,
            required: criterion.required
          })),
          structuralRolePolicies: archetype.structuralRolePolicies.map(
            (policy) => ({
              role: policy.role,
              acceptedPartKinds: policy.acceptedPartKinds,
              allowedQualityStages: policy.allowedQualityStages
            })
          ),
          attachmentPorts: archetype.attachmentPorts.map((port) => ({
            id: port.id,
            type: port.type,
            hostStructuralRoles: port.hostStructuralRoles
          }))
          })),
          specialists: specialists.map((specialist) => ({
          id: specialist.id,
          version: specialist.version,
          label: specialist.label,
          summary: specialist.summary,
          facets: specialist.facets,
          capabilities: specialist.capabilities,
          evidenceCriteria: specialist.evidenceCriteria.map(
            (criterion) => ({
              id: criterion.id,
              basis: criterion.basis,
              required: criterion.required
            })
          ),
          attachmentRequirements: specialist.attachmentRequirements.map(
            (requirement) => ({
              op: requirement.op,
              requirementId: requirement.requirementId,
              portType: requirement.portType
            })
          ),
          bindingRequirements: specialist.bindingRequirements.map(
            (requirement) => ({ type: requirement.type })
          )
          }))
        }
        : {
          archetypes: archetypes.map((archetype) => ({
            id: archetype.id,
            version: archetype.version,
            label: archetype.label,
            selected: profile.archetype.id === archetype.id
          })),
          specialists: specialists.map((specialist) => ({
            id: specialist.id,
            version: specialist.version,
            label: specialist.label,
            selected: profile.specialists.some(
              (reference) => reference.id === specialist.id
            )
          })),
          detail:
            'Inspect authoring with an authority or specialist id for its full definition.'
        },
      guidance: {
        authoritative: false,
        role: 'non-authoritative',
        recipes: listAuthoringRecipes().map((recipe) => ({
          id: recipe.id,
          label: recipe.label,
          role: recipe.role,
          archetypeId: recipe.archetype.id,
          specialistIds: recipe.specialists.map(
            (specialist) => specialist.id
          )
        })),
        notice:
          'Recipes are discovery examples only. Configure current authority explicitly; compatibility, readiness, review checks, and commands never read a recipe.'
      },
      next: profile === null
        ? 'Inspect the composable structural authority and needed specialists, then submit project.authoring.configure with claims, module slots, and bindings.'
        : plan.ready
          ? 'Follow structural and specialist review checks at every presented view.'
          : 'Correct the reported plan issues, then inspect authoring again.'
    },
    DETAIL_INSPECT_LIMIT
  );
};
