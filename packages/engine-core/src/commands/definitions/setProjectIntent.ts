import {
  PROJECT_INTENT_LIMITS,
  normalizeProjectIntent,
  projectIntentsEqual
} from '../../project/projectIntent';
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
    }
  },
  required: ['subject'],
  additionalProperties: false
} as const;

const completeIntentInput = (
  input: ProjectIntentInput
): unknown => ({
  subject: input.subject,
  forward: input.forward ?? 'north',
  grounding: input.grounding ?? 'free',
  features: input.features ?? []
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
