import type { AnimationClip } from '../../model';
import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    name: {
      type: 'string',
      minLength: 1
    },
    durationSeconds: {
      type: 'number',
      minimum: 0.001
    },
    fps: {
      type: 'number',
      minimum: 1,
      maximum: 240
    },
    loop: {
      enum: ['once', 'loop', 'hold_on_last_frame']
    }
  },
  required: ['id', 'name', 'durationSeconds', 'fps', 'loop'],
  additionalProperties: false
} as const;

export const upsertAnimationClipCommand = defineCommand({
  name: 'animation.clip.upsert',
  label: 'Create or configure animation clip',
  purpose: 'Create an animation clip or update its timing and loop settings.',
  inputSchema,
  apply: (document, payload) => {
    const current = document.animations[payload.id];
    const clip: AnimationClip = current
      ? {
          ...current,
          name: payload.name,
          durationSeconds: payload.durationSeconds,
          fps: payload.fps,
          loop: payload.loop
        }
      : {
          id: payload.id,
          name: payload.name,
          durationSeconds: payload.durationSeconds,
          fps: payload.fps,
          loop: payload.loop,
          channels: {},
          triggers: {}
        };
    return {
      ok: true,
      value: {
        document: {
          ...document,
          animations: {
            ...document.animations,
            [clip.id]: clip
          }
        },
        summary: current ? `Configure ${clip.name}` : `Create ${clip.name}`,
        effects: {
          createdEntityIds: current ? [] : [clip.id],
          changedEntityIds: current ? [clip.id] : [],
          removedEntityIds: [],
          invalidated: ['animations', 'validation', 'preview']
        }
      }
    };
  }
});
