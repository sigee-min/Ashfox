import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['clipId'],
  additionalProperties: false
} as const;

export const deleteAnimationClipCommand = defineCommand({
  name: 'animation.clip.delete',
  label: 'Delete animation clip',
  purpose: 'Delete one animation clip and its channels and triggers.',
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
    const animations = Object.fromEntries(
      Object.entries(document.animations).filter(
        ([clipId]) => clipId !== payload.clipId
      )
    );
    return {
      ok: true,
      value: {
        document: {
          ...document,
          animations
        },
        summary: `Delete ${clip.name}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [],
          removedEntityIds: [clip.id],
          invalidated: ['animations', 'validation', 'preview']
        }
      }
    };
  }
});
