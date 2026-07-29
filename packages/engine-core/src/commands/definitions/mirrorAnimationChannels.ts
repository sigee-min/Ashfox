import type {
  AnimationScalar,
  TransformChannel,
  TransformChannelProperty
} from '../../model';
import { defineCommand } from '../definition';
import { axisSchema, entityIdsSchema } from './schemas';
import { axisIndex } from './sceneHelpers';
import type { SceneAxis } from '../types';

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    },
    channelIds: entityIdsSchema,
    axis: axisSchema
  },
  required: ['clipId', 'channelIds', 'axis'],
  additionalProperties: false
} as const;

const mirrorScalar = (
  scalar: AnimationScalar,
  negate: boolean
): AnimationScalar | null => {
  if (!negate) return scalar;
  return typeof scalar === 'number' ? -scalar : null;
};

const shouldNegate = (
  property: TransformChannelProperty,
  valueIndex: number,
  mirrorIndex: number
): boolean => {
  if (property === 'position') return valueIndex === mirrorIndex;
  if (property === 'rotation') return valueIndex !== mirrorIndex;
  return false;
};

const mirrorChannel = (
  channel: TransformChannel,
  axis: SceneAxis
): TransformChannel | null => {
  const mirrorIndex = axisIndex(axis);
  const keys = channel.keys.map((key) => {
    const x = mirrorScalar(
      key.value[0],
      shouldNegate(channel.property, 0, mirrorIndex)
    );
    const y = mirrorScalar(
      key.value[1],
      shouldNegate(channel.property, 1, mirrorIndex)
    );
    const z = mirrorScalar(
      key.value[2],
      shouldNegate(channel.property, 2, mirrorIndex)
    );
    if (x === null || y === null || z === null) return null;
    return {
      ...key,
      value: [x, y, z] as const
    };
  });
  if (keys.some((key) => key === null)) return null;
  return {
    ...channel,
    keys: keys as TransformChannel['keys']
  };
};

export const mirrorAnimationChannelsCommand = defineCommand({
  name: 'animation.channels.mirror',
  label: 'Mirror animation channels',
  purpose: 'Mirror numeric position and rotation key values across one axis.',
  inputSchema,
  apply: (document, payload) => {
    const clip = document.animations[payload.clipId];
    const missingId = payload.channelIds.find(
      (channelId) => !clip?.channels[channelId]
    );
    if (!clip || missingId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: !clip
            ? `Animation clip "${payload.clipId}" does not exist.`
            : `Animation channel "${missingId}" does not exist.`,
          path: !clip ? 'payload.clipId' : 'payload.channelIds'
        }
      };
    }
    const channels = { ...clip.channels };
    for (const channelId of payload.channelIds) {
      const mirrored = mirrorChannel(channels[channelId], payload.axis);
      if (!mirrored) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message: 'Molang key values cannot be mirrored deterministically.',
            path: `payload.channelIds.${channelId}`
          }
        };
      }
      channels[channelId] = mirrored;
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
        summary: `Mirror ${payload.channelIds.length} animation channel${payload.channelIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.channelIds,
          removedEntityIds: [],
          invalidated: ['animations', 'validation', 'preview']
        }
      }
    };
  }
});
