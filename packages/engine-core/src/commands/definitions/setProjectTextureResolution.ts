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
    'Set the generated texture recipe resolution; textures.sync rebuilds derived atlases.',
  inputSchema,
  apply: (document, payload) => {
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
          }
        },
        summary: `Set texture canvas to ${payload.size} × ${payload.size}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [document.id],
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
