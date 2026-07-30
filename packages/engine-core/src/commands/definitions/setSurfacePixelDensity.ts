import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    density: {
      enum: [1, 2, 4]
    }
  },
  required: ['density'],
  additionalProperties: false
} as const;

export const setSurfacePixelDensityCommand = defineCommand({
  name: 'textures.density.set',
  label: 'Set surface pixel density',
  purpose:
    'Set 1×, 2×, or 4× square-pixel density; derived surfaces update automatically.',
  inputSchema,
  apply: (document, payload) => {
    const densityChanged =
      document.settings.surfacePixelDensity !== payload.density;
    const next = densityChanged
      ? {
          ...document,
          settings: {
            ...document.settings,
            surfacePixelDensity: payload.density
          }
        }
      : document;
    return {
      ok: true,
      value: {
        document: next,
        summary: `Set surface detail to ${payload.density}×`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: densityChanged ? [document.id] : [],
          removedEntityIds: [],
          invalidated: densityChanged
            ? ['textures', 'uv', 'validation', 'preview'] as const
            : []
        }
      }
    };
  }
});
