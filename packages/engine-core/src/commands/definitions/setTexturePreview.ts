import { defineCommand } from '../definition';
import { colorSchema } from './schemas';

const inputSchema = {
  type: 'object',
  properties: {
    textureId: {
      type: 'string',
      minLength: 1
    },
    color: colorSchema
  },
  required: ['textureId', 'color'],
  additionalProperties: false
} as const;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const setTexturePreviewCommand = defineCommand({
  name: 'textures.preview.set',
  label: 'Set texture preview color',
  purpose: 'Set the deterministic viewport color for a texture asset.',
  inputSchema,
  apply: (document, payload) => {
    const texture = document.textures[payload.textureId];
    if (!texture || !COLOR_PATTERN.test(payload.color)) {
      return {
        ok: false,
        error: {
          code: texture ? 'invalid_payload' : 'invalid_state',
          message: texture
            ? 'Texture preview color must use #RRGGBB.'
            : `Texture "${payload.textureId}" does not exist.`,
          path: texture ? 'payload.color' : 'payload.textureId'
        }
      };
    }
    if (texture.metadata?.previewColor === payload.color) {
      return {
        ok: true,
        value: {
          document,
          summary: `Keep ${texture.name} preview color`,
          effects: {
            createdEntityIds: [],
            changedEntityIds: [],
            removedEntityIds: [],
            invalidated: []
          }
        }
      };
    }
    return {
      ok: true,
      value: {
        document: {
          ...document,
          textures: {
            ...document.textures,
            [texture.id]: {
              ...texture,
              metadata: {
                ...texture.metadata,
                previewColor: payload.color
              }
            }
          }
        },
        summary: `Set ${texture.name} preview color`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [texture.id],
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'preview']
        }
      }
    };
  }
});
