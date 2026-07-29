import type { TransformChannel } from '../../model';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    },
    channelIds: entityIdsSchema,
    offsetSeconds: {
      type: 'number'
    },
    wrap: {
      type: 'boolean'
    }
  },
  required: ['clipId', 'channelIds', 'offsetSeconds', 'wrap'],
  additionalProperties: false
} as const;

const phaseChannel = (
  channel: TransformChannel,
  duration: number,
  offset: number,
  wrap: boolean
): TransformChannel | null => {
  const keys = channel.keys.map((key) => {
    const shifted = key.timeSeconds + offset;
    const timeSeconds = wrap
      ? ((shifted % duration) + duration) % duration
      : shifted;
    return {
      ...key,
      timeSeconds
    };
  });
  if (
    !wrap &&
    keys.some(
      (key) => key.timeSeconds < 0 || key.timeSeconds > duration
    )
  ) {
    return null;
  }
  return {
    ...channel,
    keys: keys.sort((left, right) => left.timeSeconds - right.timeSeconds)
  };
};

export const phaseAnimationChannelsCommand = defineCommand({
  name: 'animation.channels.phase',
  label: 'Phase animation channels',
  purpose: 'Shift channel timing with optional clip-duration wrapping.',
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
      const phased = phaseChannel(
        channels[channelId],
        clip.durationSeconds,
        payload.offsetSeconds,
        payload.wrap
      );
      if (!phased) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message: 'Phase shift moves a key outside the clip duration.',
            path: 'payload.offsetSeconds',
            expected: 'offset within clip or wrap=true'
          }
        };
      }
      channels[channelId] = phased;
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
        summary: `Phase ${payload.channelIds.length} animation channel${payload.channelIds.length === 1 ? '' : 's'}`,
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
