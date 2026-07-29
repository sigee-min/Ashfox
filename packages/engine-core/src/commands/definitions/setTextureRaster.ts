import { defineCommand } from '../definition';
import { colorSchema } from './schemas';

const rectangleSchema = {
  type: 'object',
  properties: {
    x: {
      type: 'number',
      minimum: 0
    },
    y: {
      type: 'number',
      minimum: 0
    },
    width: {
      type: 'number',
      minimum: 1
    },
    height: {
      type: 'number',
      minimum: 1
    },
    color: colorSchema
  },
  required: ['x', 'y', 'width', 'height', 'color'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    textureId: {
      type: 'string',
      minLength: 1
    },
    background: colorSchema,
    rectangles: {
      type: 'array',
      items: rectangleSchema,
      maxItems: 256
    }
  },
  required: ['textureId', 'background', 'rectangles'],
  additionalProperties: false
} as const;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const setTextureRasterCommand = defineCommand({
  name: 'textures.raster.set',
  label: 'Set texture raster',
  purpose: 'Build a deterministic pixel texture from colored rectangles.',
  inputSchema,
  apply: (document, payload) => {
    const texture = document.textures[payload.textureId];
    const invalidRectangle = payload.rectangles.find(
      (rectangle) =>
        !Number.isInteger(rectangle.x) ||
        !Number.isInteger(rectangle.y) ||
        !Number.isInteger(rectangle.width) ||
        !Number.isInteger(rectangle.height) ||
        rectangle.x + rectangle.width > (texture?.width ?? 0) ||
        rectangle.y + rectangle.height > (texture?.height ?? 0) ||
        !COLOR_PATTERN.test(rectangle.color)
    );
    if (
      !texture ||
      !COLOR_PATTERN.test(payload.background) ||
      invalidRectangle
    ) {
      return {
        ok: false,
        error: {
          code: texture ? 'invalid_payload' : 'invalid_state',
          message: !texture
            ? `Texture "${payload.textureId}" does not exist.`
            : 'Texture raster colors and integer rectangles must fit inside the texture.',
          path: texture
            ? 'payload.rectangles'
            : 'payload.textureId',
          expected: texture
            ? `${texture.width} × ${texture.height} #RRGGBB raster`
            : undefined
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
              raster: {
                background: payload.background,
                rectangles: payload.rectangles
              }
            }
          }
        },
        summary: `Set ${texture.name} texture raster`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [texture.id],
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
