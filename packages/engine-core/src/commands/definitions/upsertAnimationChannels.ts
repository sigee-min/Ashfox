import type {
  TransformChannel,
  TransformKeyframe
} from '../../model';
import { defineCommand } from '../definition';
import { animationVec3Schema } from './schemas';

const keySchema = {
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
    value: animationVec3Schema,
    interpolation: {
      enum: ['linear', 'step', 'catmullrom']
    }
  },
  required: ['id', 'timeSeconds', 'value'],
  additionalProperties: false
} as const;

const channelSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    targetNodeId: {
      type: 'string',
      minLength: 1
    },
    property: {
      enum: ['position', 'rotation', 'scale']
    },
    keys: {
      type: 'array',
      minItems: 1,
      maxItems: 512,
      items: keySchema
    }
  },
  required: ['id', 'targetNodeId', 'property', 'keys'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    },
    channels: {
      type: 'array',
      minItems: 1,
      maxItems: 128,
      items: channelSchema
    }
  },
  required: ['clipId', 'channels'],
  additionalProperties: false
} as const;

const buildKey = (
  key: {
    id: string;
    timeSeconds: number;
    value: TransformKeyframe['value'];
    interpolation?: TransformKeyframe['interpolation'];
  }
): TransformKeyframe => ({
  id: key.id,
  timeSeconds: key.timeSeconds,
  value: key.value,
  interpolation: key.interpolation ?? 'linear'
});

export const upsertAnimationChannelsCommand = defineCommand({
  name: 'animation.channels.upsert',
  label: 'Set animation channels',
  purpose: 'Create or replace transform channels with ordered keyframes.',
  inputSchema,
  apply: (document, payload) => {
    const clip = document.animations[payload.clipId];
    const invalidTarget = payload.channels.find(
      (channel) => !document.scene.nodes[channel.targetNodeId]
    );
    const duplicateChannelId = payload.channels
      .map((channel) => channel.id)
      .find((id, index, ids) => ids.indexOf(id) !== index);
    const duplicateKeyId = payload.channels.find((channel) => {
      const ids = channel.keys.map((key) => key.id);
      return new Set(ids).size !== ids.length;
    });
    if (!clip || invalidTarget || duplicateChannelId || duplicateKeyId) {
      return {
        ok: false,
        error: {
          code: clip ? 'invalid_payload' : 'invalid_state',
          message: !clip
            ? `Animation clip "${payload.clipId}" does not exist.`
            : invalidTarget
              ? `Target node "${invalidTarget.targetNodeId}" does not exist.`
              : 'Animation channel and key IDs must be unique.',
          path: !clip ? 'payload.clipId' : 'payload.channels'
        }
      };
    }
    const channels = { ...clip.channels };
    for (const input of payload.channels) {
      const channel: TransformChannel = {
        id: input.id,
        targetNodeId: input.targetNodeId,
        property: input.property,
        keys: input.keys
          .map(buildKey)
          .sort((left, right) => left.timeSeconds - right.timeSeconds)
      };
      channels[channel.id] = channel;
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
              channels
            }
          }
        },
        summary: `Set ${payload.channels.length} animation channel${payload.channels.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.channels.map((channel) => channel.id),
          removedEntityIds: [],
          invalidated: ['animations', 'validation', 'preview']
        }
      }
    };
  }
});
