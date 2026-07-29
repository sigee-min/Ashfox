import { defineCommand } from '../definition';

const trackSchema = {
  type: 'object',
  properties: {
    kind: {
      enum: ['channel', 'trigger']
    },
    id: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['kind', 'id'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    },
    tracks: {
      type: 'array',
      items: trackSchema,
      minItems: 1,
      maxItems: 128,
      uniqueItems: true
    }
  },
  required: ['clipId', 'tracks'],
  additionalProperties: false
} as const;

export const deleteAnimationTracksCommand = defineCommand({
  name: 'animation.tracks.delete',
  label: 'Delete animation tracks',
  purpose:
    'Delete selected transform channels or event tracks without rebuilding the clip.',
  inputSchema,
  apply: (document, payload) => {
    const clip = document.animations[payload.clipId];
    if (!clip) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Animation clip "${payload.clipId}" does not exist.`,
          path: 'payload.clipId'
        }
      };
    }
    const missingTrack = payload.tracks.find((track) =>
      track.kind === 'channel'
        ? clip.channels[track.id] === undefined
        : clip.triggers[track.id] === undefined
    );
    if (missingTrack) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Animation ${missingTrack.kind} "${missingTrack.id}" ` +
            `does not exist in clip "${clip.id}".`,
          path: 'payload.tracks'
        }
      };
    }
    const channelIds = new Set(
      payload.tracks
        .filter((track) => track.kind === 'channel')
        .map((track) => track.id)
    );
    const triggerIds = new Set(
      payload.tracks
        .filter((track) => track.kind === 'trigger')
        .map((track) => track.id)
    );
    const channels = Object.fromEntries(
      Object.entries(clip.channels).filter(
        ([channelId]) => !channelIds.has(channelId)
      )
    );
    const triggers = Object.fromEntries(
      Object.entries(clip.triggers).filter(
        ([triggerId]) => !triggerIds.has(triggerId)
      )
    );
    return {
      ok: true,
      value: {
        document: {
          ...document,
          animations: {
            ...document.animations,
            [clip.id]: {
              ...clip,
              channels,
              triggers
            }
          }
        },
        summary:
          payload.tracks.length === 1
            ? `Delete animation ${payload.tracks[0].kind} ${payload.tracks[0].id}`
            : `Delete ${payload.tracks.length} animation tracks`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [clip.id],
          removedEntityIds: payload.tracks.map((track) => track.id),
          invalidated: ['animations', 'validation', 'preview']
        }
      }
    };
  }
});
