import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    textureId: {
      type: 'string',
      minLength: 1
    },
    name: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['textureId', 'name'],
  additionalProperties: false
} as const;

export const renameTextureCommand = defineCommand({
  name: 'textures.rename',
  label: 'Rename texture',
  purpose: 'Set the stable display name of one texture asset.',
  inputSchema,
  apply: (document, payload) => {
    const texture = document.textures[payload.textureId];
    const name = payload.name.trim();
    if (!texture || name.length === 0) {
      return {
        ok: false,
        error: {
          code: texture ? 'invalid_payload' : 'invalid_state',
          message: texture
            ? 'Texture name cannot be empty.'
            : `Texture "${payload.textureId}" does not exist.`,
          path: texture ? 'payload.name' : 'payload.textureId'
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
              name
            }
          }
        },
        summary: `Rename texture to ${name}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [texture.id],
          removedEntityIds: [],
          invalidated: ['textures', 'validation', 'preview']
        }
      }
    };
  }
});
