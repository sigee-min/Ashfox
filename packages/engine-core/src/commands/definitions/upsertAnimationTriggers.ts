import type {
  AnimationTriggerTrack,
  ProjectDocument
} from '../../model';
import { defineCommand } from '../definition';
import type {
  AnimationTriggerInput
} from '../types';

const molangSchema = {
  type: 'object',
  properties: {
    kind: {
      enum: ['molang']
    },
    source: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['kind', 'source'],
  additionalProperties: false
} as const;

const effectSchema = {
  type: 'object',
  properties: {
    effect: {
      type: 'string',
      minLength: 1
    },
    locatorId: {
      type: 'string',
      minLength: 1
    },
    preEffectScript: molangSchema,
    bindToActor: {
      type: 'boolean'
    }
  },
  required: ['effect'],
  additionalProperties: false
} as const;

const effectKeySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    timeSeconds: {
      type: 'number',
      minimum: 0
    },
    value: effectSchema
  },
  required: ['id', 'timeSeconds', 'value'],
  additionalProperties: false
} as const;

const timelineKeySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    timeSeconds: {
      type: 'number',
      minimum: 0
    },
    value: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['id', 'timeSeconds', 'value'],
  additionalProperties: false
} as const;

const effectTrackSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    type: {
      enum: ['sound', 'particle']
    },
    keys: {
      type: 'array',
      minItems: 1,
      maxItems: 128,
      items: effectKeySchema
    }
  },
  required: ['id', 'type', 'keys'],
  additionalProperties: false
} as const;

const timelineTrackSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    type: {
      enum: ['timeline']
    },
    keys: {
      type: 'array',
      minItems: 1,
      maxItems: 128,
      items: timelineKeySchema
    }
  },
  required: ['id', 'type', 'keys'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    },
    triggers: {
      type: 'array',
      minItems: 1,
      maxItems: 32,
      items: {
        anyOf: [effectTrackSchema, timelineTrackSchema]
      }
    }
  },
  required: ['clipId', 'triggers'],
  additionalProperties: false
} as const;

const buildTrigger = (
  input: AnimationTriggerInput
): AnimationTriggerTrack => {
  if (input.type === 'timeline') {
    return {
      id: input.id,
      type: input.type,
      keys: [...input.keys].sort(
        (left, right) => left.timeSeconds - right.timeSeconds
      )
    };
  }
  return {
    id: input.id,
    type: input.type,
    keys: [...input.keys].sort(
      (left, right) => left.timeSeconds - right.timeSeconds
    )
  };
};

const duplicateId = (
  values: readonly { id: string }[]
): string | undefined =>
  values
    .map((value) => value.id)
    .find((id, index, ids) => ids.indexOf(id) !== index);

const validateTriggerInputs = (
  document: ProjectDocument,
  clipId: string,
  triggers: readonly AnimationTriggerInput[]
): string | null => {
  const clip = document.animations[clipId];
  if (!clip) return `Animation clip "${clipId}" does not exist.`;
  const repeatedTrack = duplicateId(triggers);
  if (repeatedTrack) {
    return `Animation trigger ID "${repeatedTrack}" is duplicated.`;
  }
  for (const trigger of triggers) {
    const repeatedKey = duplicateId(trigger.keys);
    if (repeatedKey) {
      return `Animation trigger key ID "${repeatedKey}" is duplicated.`;
    }
    if (
      trigger.keys.some(
        (key) => key.timeSeconds > clip.durationSeconds
      )
    ) {
      return `Animation trigger "${trigger.id}" exceeds the clip duration.`;
    }
  }
  return null;
};

export const upsertAnimationTriggersCommand = defineCommand({
  name: 'animation.triggers.upsert',
  label: 'Set animation events',
  purpose: 'Create or replace sound, particle, and timeline event tracks.',
  inputSchema,
  apply: (document, payload) => {
    const error = validateTriggerInputs(
      document,
      payload.clipId,
      payload.triggers
    );
    if (error) {
      return {
        ok: false,
        error: {
          code: document.animations[payload.clipId]
            ? 'invalid_payload'
            : 'invalid_state',
          message: error,
          path: document.animations[payload.clipId]
            ? 'payload.triggers'
            : 'payload.clipId'
        }
      };
    }
    const clip = document.animations[payload.clipId];
    const triggers = { ...clip.triggers };
    for (const input of payload.triggers) {
      triggers[input.id] = buildTrigger(input);
    }
    return {
      ok: true,
      value: {
        document: {
          ...document,
          animations: {
            ...document.animations,
            [clip.id]: {
              ...clip,
              triggers
            }
          }
        },
        summary: `Set ${payload.triggers.length} animation event track${
          payload.triggers.length === 1 ? '' : 's'
        }`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.triggers.map((trigger) => trigger.id),
          removedEntityIds: [],
          invalidated: ['animations', 'validation', 'preview']
        }
      }
    };
  }
});
