import {
  AUTHORING_PROFILE_LIMITS,
  createAuthoringProfile
} from '../../authoring/authoringProfile';
import {
  listArchetypes,
  listSpecialists
} from '../../authoring/authoringRegistry';
import {
  ARCHETYPE_IDS,
  AUTHORING_CONTACTS,
  AUTHORING_EYE_CONFIGURATIONS,
  AUTHORING_FACE_COMPONENTS,
  AUTHORING_FACE_FORMS,
  AUTHORING_FACE_MODES,
  AUTHORING_MOUTH_STATES,
  AUTHORING_PROFILE_SCHEMA_VERSION,
  AUTHORING_QUALITY_STAGES,
  AUTHORING_SPATIAL_RELATIONS,
  AUTHORING_STRUCTURAL_ROLES,
  AUTHORING_TRACKS,
  SPECIALIST_IDS
} from '../../authoring/authoringTypes';
import { canonicalJsonString } from '../../canonicalJson';
import {
  PART_CONTRACT_LIMITS,
  PART_ID_PATTERN_SOURCE
} from '../../modeling/partContract';
import { PROJECT_REFERENCE_ID_PATTERN_SOURCE } from '../../project/projectIntent';
import { defineCommand } from '../definition';
import type { CommandInputSchema } from '../schema';

const archetypeReferenceSchema: CommandInputSchema = {
  type: 'object',
  properties: {
    id: { enum: ARCHETYPE_IDS },
    version: { enum: [AUTHORING_PROFILE_SCHEMA_VERSION] }
  },
  required: ['id', 'version'],
  additionalProperties: false
};

const specialistReferenceSchema: CommandInputSchema = {
  type: 'object',
  properties: {
    id: { enum: SPECIALIST_IDS },
    version: { enum: [AUTHORING_PROFILE_SCHEMA_VERSION] }
  },
  required: ['id', 'version'],
  additionalProperties: false
};

const portIds = listArchetypes().flatMap((definition) =>
  definition.attachmentPorts.map((port) => port.id)
);
const contributionIds = listSpecialists().flatMap((definition) =>
  definition.contributions.map((contribution) => contribution.id)
);
const criterionIds = [
  ...listArchetypes(),
  ...listSpecialists()
].flatMap((definition) =>
  definition.evidenceCriteria.map((criterion) => criterion.id)
);

const partIdsSchema: CommandInputSchema = {
  type: 'array',
  minItems: 1,
  maxItems: AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
  uniqueItems: true,
  items: {
    type: 'string',
    minLength: 1,
    maxLength: PART_CONTRACT_LIMITS.maxIdLength,
    pattern: PART_ID_PATTERN_SOURCE
  }
};

const canonicalIdSchema: CommandInputSchema = {
  type: 'string',
  minLength: 1,
  maxLength: PART_CONTRACT_LIMITS.maxIdLength,
  pattern: PART_ID_PATTERN_SOURCE
};

const inputSchema: CommandInputSchema = {
  type: 'object',
  description:
    'Configure the explicit v2 composable-form authority, quality track, optional audited full-face contract, structural module graph, intent-feature coverage, topology-free specialists, grounded claims, and closed bindings.',
  properties: {
    archetype: archetypeReferenceSchema,
    track: { enum: AUTHORING_TRACKS },
    faceMode: { enum: AUTHORING_FACE_MODES },
    face: {
      anyOf: [
        { enum: [null] },
        {
          type: 'object',
          properties: {
            hostSlotId: canonicalIdSchema,
            mouthState: { enum: AUTHORING_MOUTH_STATES },
            components: {
              type: 'array',
              minItems: 1,
              maxItems: AUTHORING_FACE_COMPONENTS.length,
              items: {
                type: 'object',
                properties: {
                  component: { enum: AUTHORING_FACE_COMPONENTS },
                  form: { enum: AUTHORING_FACE_FORMS },
                  configuration: {
                    anyOf: [
                      { enum: AUTHORING_EYE_CONFIGURATIONS },
                      { enum: [null] }
                    ]
                  },
                  slotIds: {
                    type: 'array',
                    minItems: 1,
                    maxItems: AUTHORING_PROFILE_LIMITS.maxSlots,
                    uniqueItems: true,
                    items: canonicalIdSchema
                  },
                  materialIds: {
                    type: 'array',
                    minItems: 1,
                    maxItems: AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
                    uniqueItems: true,
                    items: canonicalIdSchema
                  }
                },
                required: [
                  'component',
                  'form',
                  'configuration',
                  'slotIds',
                  'materialIds'
                ],
                additionalProperties: false
              }
            },
            exceptions: {
              type: 'array',
              minItems: 0,
              maxItems: 2,
              items: {
                type: 'object',
                properties: {
                  component: { enum: ['nasal', 'oral'] },
                  basis: { enum: ['observed', 'requested'] },
                  referenceIds: {
                    type: 'array',
                    minItems: 1,
                    maxItems: AUTHORING_PROFILE_LIMITS.maxClaimReferenceIds,
                    uniqueItems: true,
                    items: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 64,
                      pattern:
                        `^(?:(?:${PROJECT_REFERENCE_ID_PATTERN_SOURCE.slice(1, -1)})|` +
                        '(?:intent\\.(?:subject|features\\.(?:0|[1-9][0-9]*))))$'
                    }
                  },
                  rationale: {
                    type: 'string',
                    minLength: 1,
                    maxLength: AUTHORING_PROFILE_LIMITS.maxClaimRationaleLength
                  }
                },
                required: [
                  'component',
                  'basis',
                  'referenceIds',
                  'rationale'
                ],
                additionalProperties: false
              }
            }
          },
          required: [
            'hostSlotId',
            'mouthState',
            'components',
            'exceptions'
          ],
          additionalProperties: false
        }
      ]
    },
    specialists: {
      type: 'array',
      minItems: 0,
      maxItems: AUTHORING_PROFILE_LIMITS.maxSpecialists,
      uniqueItems: true,
      items: specialistReferenceSchema
    },
    claims: {
      type: 'array',
      minItems: 1,
      maxItems: AUTHORING_PROFILE_LIMITS.maxClaims,
      items: {
        type: 'object',
        properties: {
          authority: {
            anyOf: [archetypeReferenceSchema, specialistReferenceSchema]
          },
          criterionId: { enum: [...new Set(criterionIds)] },
          basis: { enum: ['observed', 'requested'] },
          referenceIds: {
            type: 'array',
            minItems: 1,
            maxItems: AUTHORING_PROFILE_LIMITS.maxClaimReferenceIds,
            uniqueItems: true,
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 64,
              pattern:
                `^(?:(?:${PROJECT_REFERENCE_ID_PATTERN_SOURCE.slice(1, -1)})|` +
                '(?:intent\\.(?:subject|features\\.(?:0|[1-9][0-9]*))))$'
            }
          },
          rationale: {
            type: 'string',
            minLength: 1,
            maxLength: AUTHORING_PROFILE_LIMITS.maxClaimRationaleLength
          }
        },
        required: [
          'authority',
          'criterionId',
          'basis',
          'referenceIds',
          'rationale'
        ],
        additionalProperties: false
      }
    },
    slots: {
      type: 'array',
      minItems: 1,
      maxItems: AUTHORING_PROFILE_LIMITS.maxSlots,
      items: {
        type: 'object',
        properties: {
          slotId: canonicalIdSchema,
          structuralRole: { enum: AUTHORING_STRUCTURAL_ROLES },
          qualityStage: { enum: AUTHORING_QUALITY_STAGES },
          partIds: partIdsSchema,
          parentSlotIds: {
            type: 'array',
            minItems: 0,
            maxItems: AUTHORING_PROFILE_LIMITS.maxSlots,
            uniqueItems: true,
            items: canonicalIdSchema
          },
          spatialRelations: {
            type: 'array',
            minItems: 0,
            maxItems: AUTHORING_SPATIAL_RELATIONS.length,
            uniqueItems: true,
            items: { enum: AUTHORING_SPATIAL_RELATIONS }
          },
          facing: { enum: ['forward', null] },
          pairId: { anyOf: [canonicalIdSchema, { enum: [null] }] },
          contact: { enum: AUTHORING_CONTACTS }
        },
        required: [
          'slotId',
          'structuralRole',
          'qualityStage',
          'partIds',
          'parentSlotIds',
          'spatialRelations',
          'facing',
          'pairId',
          'contact'
        ],
        additionalProperties: false
      }
    },
    coverage: {
      type: 'array',
      minItems: 0,
      maxItems: AUTHORING_PROFILE_LIMITS.maxSlots,
      items: {
        type: 'object',
        properties: {
          featureRef: {
            type: 'string',
            minLength: 17,
            maxLength: 32,
            pattern: '^intent\\.features\\.(?:0|[1-9][0-9]*)$'
          },
          slotIds: {
            type: 'array',
            minItems: 0,
            maxItems: AUTHORING_PROFILE_LIMITS.maxSlots,
            uniqueItems: true,
            items: canonicalIdSchema
          },
          materialIds: {
            type: 'array',
            minItems: 0,
            maxItems: AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
            uniqueItems: true,
            items: canonicalIdSchema
          }
        },
        required: ['featureRef', 'slotIds', 'materialIds'],
        additionalProperties: false
      }
    },
    bindings: {
      type: 'array',
      minItems: 0,
      maxItems: AUTHORING_PROFILE_LIMITS.maxBindings,
      items: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { enum: ['attachment'] },
              contributionId: { enum: contributionIds },
              portId: { enum: [...new Set(portIds)] },
              hostSlotId: canonicalIdSchema,
              partIds: partIdsSchema
            },
            required: [
              'type',
              'contributionId',
              'portId',
              'hostSlotId',
              'partIds'
            ],
            additionalProperties: false
          },
          {
            type: 'object',
            properties: {
              type: { enum: ['motion'] },
              specialist: specialistReferenceSchema,
              clipId: {
                type: 'string',
                minLength: 1,
                maxLength: PART_CONTRACT_LIMITS.maxIdLength,
                pattern: PART_ID_PATTERN_SOURCE
              },
              role: { enum: ['idle', 'loop', 'once'] }
            },
            required: ['type', 'specialist', 'clipId', 'role'],
            additionalProperties: false
          }
        ]
      }
    }
  },
  required: [
    'archetype',
    'track',
    'faceMode',
    'face',
    'specialists',
    'claims',
    'slots',
    'coverage',
    'bindings'
  ],
  additionalProperties: false
};

export const configureAuthoringCommand = defineCommand({
  name: 'project.authoring.configure',
  label: 'Configure authoring authorities',
  purpose:
    'Persist the v2 composable authority, quality track, explicit face mode, structural graph, verified intent coverage, and topology-free specialist plan.',
  inputSchema,
  apply: (document, payload) => {
    const normalized = createAuthoringProfile(document, payload);
    if (!normalized.ok) {
      const issue = normalized.issues[0];
      return {
        ok: false,
        error: {
          code: issue?.path === 'intent' ? 'invalid_state' : 'invalid_payload',
          message: issue?.message ?? 'Authoring authority selection is invalid.',
          path: issue?.path === 'intent'
            ? 'intent'
            : `payload.${issue?.path ?? '$'}`,
          pathScope: issue?.path === 'intent' ? 'document' : 'operation',
          expected: issue?.expected
        }
      };
    }
    const changed =
      canonicalJsonString(document.authoringProfile) !==
      canonicalJsonString(normalized.profile);
    return {
      ok: true,
      value: {
        document: changed
          ? { ...document, authoringProfile: normalized.profile }
          : document,
        summary:
          `Configured ${normalized.profile.archetype.id} with ` +
          `${normalized.profile.specialists.length} specialist(s)`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: changed ? [document.id] : [],
          removedEntityIds: [],
          invalidated: changed ? ['validation', 'preview'] as const : []
        }
      }
    };
  }
});
