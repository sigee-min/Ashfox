import { defineCommand } from '../definition';
import { PROJECT_TEXTURE_RESOLUTIONS } from '../projectTextureResolution';

const inputSchema = {
  type: 'object',
  properties: {
    size: {
      enum: PROJECT_TEXTURE_RESOLUTIONS
    }
  },
  required: ['size'],
  additionalProperties: false
} as const;

export const setProjectTextureResolutionCommand = defineCommand({
  name: 'project.textureResolution.set',
  label: 'Set project texture resolution',
  purpose:
    'Set the square project texture canvas and resize generated raster textures atomically.',
  inputSchema,
  apply: (document, payload) => {
    const changedTextureIds = Object.values(document.textures)
      .filter(
        (texture) =>
          texture.atlasMode === 'generate' &&
          (
            texture.width !== payload.size ||
            texture.height !== payload.size
          )
      )
      .map((texture) => texture.id);
    const textures = Object.fromEntries(
      Object.entries(document.textures).map(([id, texture]) => [
        id,
        texture.atlasMode === 'generate'
          ? {
              ...texture,
              width: payload.size,
              height: payload.size
            }
          : texture
      ])
    );
    return {
      ok: true,
      value: {
        document: {
          ...document,
          settings: {
            ...document.settings,
            textureResolution: {
              width: payload.size,
              height: payload.size
            }
          },
          textures
        },
        summary: `Set texture canvas to ${payload.size} × ${payload.size}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [document.id, ...changedTextureIds],
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
