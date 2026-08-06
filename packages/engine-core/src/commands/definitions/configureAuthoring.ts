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
  AUTHORING_PROFILE_SCHEMA_VERSION,
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

const slotIds = listArchetypes().flatMap((definition) =>
  definition.semanticSlots.map((slot) => slot.id)
);
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

const inputSchema: CommandInputSchema = {
  type: 'object',
  description:
    'Configure one explicit v1 archetype, zero or more unclassified specialists, grounded authority claims, archetype slots, and closed attachment or motion bindings.',
  properties: {
    archetype: archetypeReferenceSchema,
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
      minItems: 0,
      maxItems: AUTHORING_PROFILE_LIMITS.maxSlots,
      items: {
        type: 'object',
        properties: {
          slotId: { enum: [...new Set(slotIds)] },
          partIds: partIdsSchema,
          reason: { type: 'string', minLength: 1, maxLength: 240 }
        },
        required: ['slotId', 'partIds'],
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
              hostSlotId: { enum: [...new Set(slotIds)] },
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
  required: ['archetype', 'specialists', 'claims', 'slots', 'bindings'],
  additionalProperties: false
};

export const configureAuthoringCommand = defineCommand({
  name: 'project.authoring.configure',
  label: 'Configure authoring authorities',
  purpose:
    'Persist the single v1 archetype and specialist authority plan grounded in current intent provenance.',
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
