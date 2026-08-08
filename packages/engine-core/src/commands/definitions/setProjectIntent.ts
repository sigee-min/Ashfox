import {
  PROJECT_INTENT_LIMITS,
  normalizeProjectIntent,
  projectIntentsEqual
} from '../../project/projectIntent';
import {
  PROJECT_SYMMETRY_MAX_PLANE_TWICE
} from '../../project/projectSpatialFrame';
import { defineCommand } from '../definition';
import type { ProjectIntentInput } from '../types';

const inputSchema = {
  type: 'object',
  properties: {
    subject: {
      type: 'string',
      minLength: 1,
      maxLength: PROJECT_INTENT_LIMITS.maxSubjectLength,
      description:
        'Short literal name of what the project is intended to depict.'
    },
    forward: {
      enum: ['north', 'south', 'east', 'west'],
      description:
        'Declared front direction for human and agent review.'
    },
    grounding: {
      enum: ['grounded', 'airborne', 'free'],
      description:
        'Objective relation to lattice ground plane y=0.'
    },
    symmetry: {
      anyOf: [
        {
          type: 'object',
          properties: {
            kind: { enum: ['asymmetric'] }
          },
          required: ['kind'],
          additionalProperties: false
        },
        {
          type: 'object',
          properties: {
            kind: { enum: ['bilateral'] },
            planeTwice: {
              type: 'number',
              integer: true,
              minimum: -PROJECT_SYMMETRY_MAX_PLANE_TWICE,
              maximum: PROJECT_SYMMETRY_MAX_PLANE_TWICE,
              description:
                'Twice the bilateral reflection-plane coordinate on the asset lattice.'
            }
          },
          required: ['kind', 'planeTwice'],
          additionalProperties: false
        }
      ],
      description:
        'Explicitly declares whether the asset has a mathematically enforceable bilateral plane.'
    },
    features: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: PROJECT_INTENT_LIMITS.maxFeatureLength
      },
      maxItems: PROJECT_INTENT_LIMITS.maxFeatures,
      uniqueItems: true,
      description:
        'Concise visual criteria for the later semantic review.'
    },
    references: {
      type: 'array',
      maxItems: PROJECT_INTENT_LIMITS.maxReferences,
      uniqueItems: true,
      description:
        'Auditable image, text, or model observations used for authority routing and later visual review. Store observations and content hashes, never local file paths or raw bytes.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            pattern: '^[a-z][a-z0-9._-]{0,63}$'
          },
          kind: { enum: ['image', 'text', 'model'] },
          description: {
            type: 'string',
            minLength: 1,
            maxLength:
              PROJECT_INTENT_LIMITS.maxReferenceDescriptionLength
          },
          cues: {
            type: 'array',
            maxItems: PROJECT_INTENT_LIMITS.maxReferenceCues,
            uniqueItems: true,
            items: {
              type: 'string',
              minLength: 1,
              maxLength: PROJECT_INTENT_LIMITS.maxReferenceCueLength
            }
          },
          contentHash: {
            type: 'string',
            minLength: 1,
            maxLength: 160
          }
        },
        required: ['id', 'kind', 'description', 'cues'],
        additionalProperties: false
      }
    }
  },
  required: ['subject', 'forward', 'grounding', 'symmetry'],
  additionalProperties: false
} as const;

const completeIntentInput = (
  input: ProjectIntentInput
): unknown => ({
  subject: input.subject,
  forward: input.forward,
  grounding: input.grounding,
  symmetry: input.symmetry,
  features: input.features ?? [],
  references: input.references
});

export const setProjectIntentCommand = defineCommand({
  name: 'project.intent.set',
  label: 'Set project intent',
  purpose:
    'Persist an objective build and review contract without claiming semantic or visual-quality proof.',
  inputSchema,
  apply: (document, payload) => {
    const normalized = normalizeProjectIntent(
      completeIntentInput(payload)
    );
    if (!normalized.ok) {
      const issue = normalized.issues[0];
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message:
            issue?.message ?? 'Project intent is invalid.',
          path: issue ? `payload.${issue.path}` : 'payload',
          expected: issue?.expected
        }
      };
    }
    const intent = normalized.intent;
    const changed = !projectIntentsEqual(document.intent, intent);
    return {
      ok: true,
      value: {
        document: changed
          ? {
              ...document,
              intent
            }
          : document,
        summary: `Set project intent for ${intent.subject}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: changed ? [document.id] : [],
          removedEntityIds: [],
          invalidated: changed
            ? ['validation', 'preview'] as const
            : []
        }
      }
    };
  }
});
