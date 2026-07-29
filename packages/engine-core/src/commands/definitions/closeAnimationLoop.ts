import type {
  TransformChannel,
  TransformKeyframe
} from '../../model';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    },
    channelIds: entityIdsSchema
  },
  required: ['clipId', 'channelIds'],
  additionalProperties: false
} as const;

const closeChannel = (
  channel: TransformChannel,
  duration: number
): TransformChannel => {
  const sorted = [...channel.keys].sort(
    (left, right) => left.timeSeconds - right.timeSeconds
  );
  const first = sorted[0];
  if (!first) return channel;
  const start: TransformKeyframe = first.timeSeconds === 0
    ? first
    : {
        ...first,
        id: `${channel.id}-loop-start`,
        timeSeconds: 0
      };
  const last = sorted.at(-1);
  const end: TransformKeyframe = last?.timeSeconds === duration
    ? {
        ...last,
        value: start.value
      }
    : {
        ...start,
        id: `${channel.id}-loop-end`,
        timeSeconds: duration
      };
  return {
    ...channel,
    keys: [
      ...(first.timeSeconds === 0 ? [] : [start]),
      ...sorted.slice(0, last?.timeSeconds === duration ? -1 : undefined),
      end
    ]
  };
};

export const closeAnimationLoopCommand = defineCommand({
  name: 'animation.clip.closeLoop',
  label: 'Close animation loop',
  purpose: 'Match selected channel end values to their start values.',
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
      channels[channelId] = closeChannel(
        channels[channelId],
        clip.durationSeconds
      );
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
              loop: 'loop',
              channels
            }
          }
        },
        summary: `Close ${payload.channelIds.length} animation loop${payload.channelIds.length === 1 ? '' : 's'}`,
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
