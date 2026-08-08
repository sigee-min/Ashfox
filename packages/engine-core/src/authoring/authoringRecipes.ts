import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type AuthoringRecipe,
  type AuthoringRecipeSummary
} from './authoringTypes';
import { deepFreezeAuthoringValue } from './authoringCollections';

const recipes: readonly AuthoringRecipe[] = deepFreezeAuthoringValue([(() => {
  const archetype = {
    id: 'archetype.composable-form',
    version: AUTHORING_PROFILE_SCHEMA_VERSION
  } as const;
  return {
    id: 'recipe.composable-form',
    label: 'Composable form starter',
    summary:
      'A non-authoritative example showing a connected core, directional structure, host frame, and focal module declaration.',
    role: 'non-authoritative',
    archetype,
    track: 'hero',
    faceMode: 'none',
    face: null,
    specialists: [],
    claimSuggestions: [{
      authority: archetype,
      criterionId: 'criterion.structure-graph',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale:
        'Suggested structural starting point; replace or extend modules from current evidence.'
    }],
    slotSuggestions: [
      {
        slotId: 'core.primary',
        structuralRole: 'core',
        qualityStage: 'silhouette',
        partIds: ['core_primary'],
        parentSlotIds: [],
        spatialRelations: [],
        facing: null,
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      },
      {
        slotId: 'axis.primary',
        structuralRole: 'axis',
        qualityStage: 'structure',
        partIds: ['axis_primary'],
        parentSlotIds: ['core.primary'],
        spatialRelations: ['front'],
        facing: null,
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      },
      {
        slotId: 'span.left',
        structuralRole: 'span',
        qualityStage: 'silhouette',
        partIds: ['span_left'],
        parentSlotIds: ['core.primary'],
        spatialRelations: ['left'],
        facing: null,
        symmetry: { kind: 'paired', pairId: 'pair.span' },
        support: { kind: 'none' }
      },
      {
        slotId: 'span.right',
        structuralRole: 'span',
        qualityStage: 'silhouette',
        partIds: ['span_right'],
        parentSlotIds: ['core.primary'],
        spatialRelations: ['right'],
        facing: null,
        symmetry: { kind: 'paired', pairId: 'pair.span' },
        support: { kind: 'none' }
      },
      {
        slotId: 'focal.host',
        structuralRole: 'focal-frame',
        qualityStage: 'structure',
        partIds: ['focal_host'],
        parentSlotIds: ['axis.primary'],
        spatialRelations: ['front'],
        facing: null,
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      },
      {
        slotId: 'focal.glyph',
        structuralRole: 'focal-frame',
        qualityStage: 'focal',
        partIds: ['focal_glyph'],
        parentSlotIds: ['focal.host'],
        spatialRelations: [],
        facing: 'forward',
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      }
    ],
    coverageSuggestions: [{
      featureRef: 'intent.features.0',
      slotIds: ['focal.glyph'],
      materialIds: []
    }],
    bindingSuggestions: []
  } satisfies AuthoringRecipe;
})()]);

const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

const recipeSummaries: readonly AuthoringRecipeSummary[] = deepFreezeAuthoringValue(
  recipes.map((recipe) => ({
    id: recipe.id,
    label: recipe.label,
    summary: recipe.summary,
    role: recipe.role,
    archetype: recipe.archetype,
    specialists: recipe.specialists
  }))
);

export const listAuthoringRecipes =
  (): readonly AuthoringRecipeSummary[] => recipeSummaries;

export const getAuthoringRecipe = (
  id: string
): AuthoringRecipe | undefined => recipesById.get(id);
