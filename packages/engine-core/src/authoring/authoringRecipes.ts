import type {
  AuthoringAuthorityClaim,
  AuthoringAuthorityId,
  AuthoringAuthorityReference,
  AuthoringRecipe,
  AuthoringRecipeSummary
} from './authoringTypes';
import { AUTHORING_PROFILE_SCHEMA_VERSION } from './authoringTypes';

const criterionByAuthority: Readonly<Record<AuthoringAuthorityId, string>> = {
  'archetype.mini-biped': 'criterion.body-plan',
  'archetype.pillar-stalker': 'criterion.body-plan',
  'archetype.quadruped': 'criterion.body-plan',
  'archetype.compact-construct': 'criterion.body-plan',
  'specialist.role-props': 'criterion.role-cue',
  'specialist.hard-surface': 'criterion.construction-cue',
  'specialist.decay-cues': 'criterion.decay-cue',
  'specialist.arcane-cues': 'criterion.arcane-cue',
  'specialist.organic-cues': 'criterion.organic-cue',
  'specialist.protective-shell': 'criterion.protective-cue',
  'specialist.static-loop': 'criterion.presentation-motion',
  'specialist.alternating-gait': 'criterion.paired-gait',
  'specialist.stalking-gait': 'criterion.stalking-gait',
  'specialist.rotary-cycle': 'criterion.rotary-motion'
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
};

const requestedClaims = (
  authorities: readonly AuthoringAuthorityReference[]
): readonly AuthoringAuthorityClaim[] =>
  authorities.map((authority) => ({
    authority,
    criterionId: criterionByAuthority[authority.id],
    basis: 'requested',
    referenceIds: ['intent.subject'],
    rationale:
      `Suggested starting authority for the requested ${authority.id} recipe; replace or supplement with observed claims after inspecting references.`
  }));

const recipes: readonly AuthoringRecipe[] = deepFreeze([
  (() => {
    const archetype = {
      id: 'archetype.pillar-stalker',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    } as const;
    const specialists = [
      { id: 'specialist.static-loop', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.stalking-gait', version: AUTHORING_PROFILE_SCHEMA_VERSION }
    ] as const;
    return {
      id: 'recipe.creeper',
      label: 'Creeper-like stalker',
      summary: 'A narrow arm-free stalker with a graphic face and four-point gait.',
      role: 'non-authoritative',
      archetype,
      specialists,
      claimSuggestions: requestedClaims([archetype, ...specialists]),
      slotSuggestions: [
        { slotId: 'body.column', partIds: ['body_column'] },
        { slotId: 'body.head', partIds: ['head'] },
        { slotId: 'body.foot-front-left', partIds: ['foot_front_left'] },
        { slotId: 'body.foot-front-right', partIds: ['foot_front_right'] },
        { slotId: 'body.foot-rear-left', partIds: ['foot_rear_left'] },
        { slotId: 'body.foot-rear-right', partIds: ['foot_rear_right'] },
        { slotId: 'body.face', partIds: ['face'] }
      ],
      bindingSuggestions: [
        {
          type: 'motion',
          specialist: specialists[0],
          clipId: 'idle',
          role: 'idle'
        },
        {
          type: 'motion',
          specialist: specialists[1],
          clipId: 'stalk',
          role: 'loop'
        }
      ]
    } satisfies AuthoringRecipe;
  })(),
  (() => {
    const archetype = {
      id: 'archetype.mini-biped',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    } as const;
    const specialists = [
      { id: 'specialist.role-props', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.static-loop', version: AUTHORING_PROFILE_SCHEMA_VERSION }
    ] as const;
    return {
      id: 'recipe.mechanic',
      label: 'Workshop mechanic',
      summary: 'A compact upright worker whose role is carried by one practical prop.',
      role: 'non-authoritative',
      archetype,
      specialists,
      claimSuggestions: requestedClaims([archetype, ...specialists]),
      slotSuggestions: [
        { slotId: 'body.torso', partIds: ['torso'] },
        { slotId: 'body.head', partIds: ['head'] },
        { slotId: 'body.arm-left', partIds: ['arm_left'] },
        { slotId: 'body.arm-right', partIds: ['arm_right'] },
        { slotId: 'body.leg-left', partIds: ['leg_left'] },
        { slotId: 'body.leg-right', partIds: ['leg_right'] },
        { slotId: 'body.face', partIds: ['face'] }
      ],
      bindingSuggestions: [
        {
          type: 'attachment',
          contributionId: 'contribution.role-prop',
          portId: 'port.hand-or-module',
          hostSlotId: 'body.arm-right',
          partIds: ['role_prop']
        },
        {
          type: 'motion',
          specialist: specialists[1],
          clipId: 'idle',
          role: 'idle'
        }
      ]
    } satisfies AuthoringRecipe;
  })(),
  (() => {
    const archetype = {
      id: 'archetype.quadruped',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    } as const;
    const specialists = [
      { id: 'specialist.organic-cues', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.static-loop', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.alternating-gait', version: AUTHORING_PROFILE_SCHEMA_VERSION }
    ] as const;
    return {
      id: 'recipe.quadruped-companion',
      label: 'Organic quadruped companion',
      summary: 'A compact four-legged companion with one organic cue and paired gait.',
      role: 'non-authoritative',
      archetype,
      specialists,
      claimSuggestions: requestedClaims([archetype, ...specialists]),
      slotSuggestions: [
        { slotId: 'body.trunk', partIds: ['trunk'] },
        { slotId: 'body.head', partIds: ['head'] },
        { slotId: 'body.leg-front-left', partIds: ['leg_front_left'] },
        { slotId: 'body.leg-front-right', partIds: ['leg_front_right'] },
        { slotId: 'body.leg-rear-left', partIds: ['leg_rear_left'] },
        { slotId: 'body.leg-rear-right', partIds: ['leg_rear_right'] },
        { slotId: 'body.face', partIds: ['face'] }
      ],
      bindingSuggestions: [
        {
          type: 'attachment',
          contributionId: 'contribution.organic',
          portId: 'port.surface-cue',
          hostSlotId: 'body.trunk',
          partIds: ['organic_cue']
        },
        {
          type: 'motion',
          specialist: specialists[1],
          clipId: 'idle',
          role: 'idle'
        },
        {
          type: 'motion',
          specialist: specialists[2],
          clipId: 'walk',
          role: 'loop'
        }
      ]
    } satisfies AuthoringRecipe;
  })(),
  (() => {
    const archetype = {
      id: 'archetype.quadruped',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    } as const;
    const specialists = [
      { id: 'specialist.hard-surface', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.static-loop', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.alternating-gait', version: AUTHORING_PROFILE_SCHEMA_VERSION }
    ] as const;
    return {
      id: 'recipe.mechanical-quadruped',
      label: 'Mechanical quadruped',
      summary: 'A four-legged machine with one construction cue and paired gait.',
      role: 'non-authoritative',
      archetype,
      specialists,
      claimSuggestions: requestedClaims([archetype, ...specialists]),
      slotSuggestions: [
        { slotId: 'body.trunk', partIds: ['trunk'] },
        { slotId: 'body.head', partIds: ['head'] },
        { slotId: 'body.leg-front-left', partIds: ['leg_front_left'] },
        { slotId: 'body.leg-front-right', partIds: ['leg_front_right'] },
        { slotId: 'body.leg-rear-left', partIds: ['leg_rear_left'] },
        { slotId: 'body.leg-rear-right', partIds: ['leg_rear_right'] },
        { slotId: 'body.face', partIds: ['sensor_face'] }
      ],
      bindingSuggestions: [
        {
          type: 'attachment',
          contributionId: 'contribution.hard-surface',
          portId: 'port.surface-cue',
          hostSlotId: 'body.trunk',
          partIds: ['construction_cue']
        },
        {
          type: 'motion',
          specialist: specialists[1],
          clipId: 'idle',
          role: 'idle'
        },
        {
          type: 'motion',
          specialist: specialists[2],
          clipId: 'walk',
          role: 'loop'
        }
      ]
    } satisfies AuthoringRecipe;
  })(),
  (() => {
    const archetype = {
      id: 'archetype.compact-construct',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    } as const;
    const specialists = [
      { id: 'specialist.hard-surface', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.static-loop', version: AUTHORING_PROFILE_SCHEMA_VERSION },
      { id: 'specialist.rotary-cycle', version: AUTHORING_PROFILE_SCHEMA_VERSION }
    ] as const;
    return {
      id: 'recipe.compact-construct',
      label: 'Compact mechanical construct',
      summary: 'A compact functional device with one construction cue and rotary cycle.',
      role: 'non-authoritative',
      archetype,
      specialists,
      claimSuggestions: requestedClaims([archetype, ...specialists]),
      slotSuggestions: [
        { slotId: 'body.core', partIds: ['core'] },
        { slotId: 'body.support', partIds: ['support'] },
        { slotId: 'body.sensor', partIds: ['sensor'] },
        { slotId: 'body.function-module', partIds: ['function_module'] }
      ],
      bindingSuggestions: [
        {
          type: 'attachment',
          contributionId: 'contribution.hard-surface',
          portId: 'port.surface-cue',
          hostSlotId: 'body.function-module',
          partIds: ['construction_cue']
        },
        {
          type: 'motion',
          specialist: specialists[1],
          clipId: 'idle',
          role: 'idle'
        },
        {
          type: 'motion',
          specialist: specialists[2],
          clipId: 'function_cycle',
          role: 'loop'
        }
      ]
    } satisfies AuthoringRecipe;
  })()
]);

const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

const recipeSummaries: readonly AuthoringRecipeSummary[] = deepFreeze(
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
