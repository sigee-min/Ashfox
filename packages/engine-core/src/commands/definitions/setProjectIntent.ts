import {
  PROJECT_INTENT_LIMITS,
  normalizeProjectIntent,
  projectIntentsEqual
} from '../../project/projectIntent';
import {
  PART_CONTRACT_LIMITS,
  PART_ID_PATTERN_SOURCE
} from '../../modeling/partContract';
import type { ProjectDocument } from '../../model';
import { defineCommand } from '../definition';
import type { ProjectIntentInput } from '../types';

const partIdSchema = {
  type: 'string',
  minLength: 1,
  maxLength: PART_CONTRACT_LIMITS.maxIdLength,
  pattern: PART_ID_PATTERN_SOURCE
} as const;

const requiredPartIdArraySchema = {
  type: 'array',
  items: partIdSchema,
  maxItems: PROJECT_INTENT_LIMITS.maxRequiredIds,
  uniqueItems: true
} as const;

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
    requiredFeatures: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: PROJECT_INTENT_LIMITS.maxFeatureLength
      },
      maxItems: PROJECT_INTENT_LIMITS.maxRequiredFeatures,
      uniqueItems: true,
      description:
        'Short human/agent review criteria; their meaning is not machine-validated.'
    },
    requiredPartIds: requiredPartIdArraySchema,
    requiredMaterialIds: requiredPartIdArraySchema,
    requiredClipIds: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: PROJECT_INTENT_LIMITS.maxClipIdLength
      },
      maxItems: PROJECT_INTENT_LIMITS.maxRequiredIds,
      uniqueItems: true
    },
    symmetryPairs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          axis: {
            enum: ['x', 'y', 'z']
          },
          plane: {
            type: 'number',
            minimum:
              -PART_CONTRACT_LIMITS.maxAbsoluteCoordinate,
            maximum:
              PART_CONTRACT_LIMITS.maxAbsoluteCoordinate,
            description:
              'Reflection plane in lattice coordinates, using integer or half steps.'
          },
          leftPartId: partIdSchema,
          rightPartId: partIdSchema
        },
        required: [
          'axis',
          'plane',
          'leftPartId',
          'rightPartId'
        ],
        additionalProperties: false
      },
      maxItems: PROJECT_INTENT_LIMITS.maxSymmetryPairs,
      uniqueItems: true,
      description:
        'Exact unordered lattice-reflection relationships; endpoint order is canonicalized and does not assert semantic left/right identity.'
    }
  },
  required: ['subject'],
  additionalProperties: false
} as const;

const completeIntentInput = (
  document: ProjectDocument,
  input: ProjectIntentInput
): unknown => {
  const current = document.intent;
  return {
    subject: input.subject,
    forward: input.forward ?? current?.forward ?? 'north',
    grounding: input.grounding ?? current?.grounding ?? 'free',
    requiredFeatures:
      input.requiredFeatures ?? current?.requiredFeatures ?? [],
    requiredPartIds:
      input.requiredPartIds ?? current?.requiredPartIds ?? [],
    requiredMaterialIds:
      input.requiredMaterialIds ??
      current?.requiredMaterialIds ??
      [],
    requiredClipIds:
      input.requiredClipIds ?? current?.requiredClipIds ?? [],
    ...(
      input.symmetryPairs !== undefined
        ? { symmetryPairs: input.symmetryPairs }
        : current?.symmetryPairs
          ? { symmetryPairs: current.symmetryPairs }
          : {}
    )
  };
};

export const setProjectIntentCommand = defineCommand({
  name: 'project.intent.set',
  label: 'Set project intent',
  purpose:
    'Persist an objective build and review contract without claiming semantic or visual-quality proof.',
  inputSchema,
  apply: (document, payload) => {
    const normalized = normalizeProjectIntent(
      completeIntentInput(document, payload)
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
