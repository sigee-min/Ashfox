import { createTextureAsset } from '../../textures/createTextureAsset';
import { defineCommand } from '../definition';
import { colorSchema } from './schemas';

const textureSchema = {
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
    width: {
      type: 'number',
      minimum: 1,
      maximum: 8192
    },
    height: {
      type: 'number',
      minimum: 1,
      maximum: 8192
    },
    atlasMode: {
      enum: ['generate', 'preserve']
    },
    background: colorSchema
  },
  required: ['id', 'name'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    textures: {
      type: 'array',
      items: textureSchema,
      minItems: 1,
      maxItems: 32
    }
  },
  required: ['textures'],
  additionalProperties: false
} as const;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const createTexturesCommand = defineCommand({
  name: 'textures.create',
  label: 'Create textures',
  purpose:
    'Create one or more deterministic raster textures; omitted dimensions use the project texture resolution.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.textures.map((texture) => texture.id);
    const duplicateId = ids.find(
      (id, index) =>
        ids.indexOf(id) !== index || document.textures[id] !== undefined
    );
    const invalid = payload.textures.find(
      (texture) =>
        texture.name.trim().length === 0 ||
        (
          texture.width !== undefined &&
          !Number.isInteger(texture.width)
        ) ||
        (
          texture.height !== undefined &&
          !Number.isInteger(texture.height)
        ) ||
        (
          texture.background !== undefined &&
          !COLOR_PATTERN.test(texture.background)
        )
    );
    if (duplicateId || invalid) {
      return {
        ok: false,
        error: {
          code: duplicateId ? 'invalid_state' : 'invalid_payload',
          message: duplicateId
            ? `Texture ID "${duplicateId}" is already in use.`
            : 'Texture names, dimensions, and colors must be valid.',
          path: 'payload.textures'
        }
      };
    }
    const next = payload.textures.reduce(
      (current, input) => {
        const texture = createTextureAsset(current, input);
        return {
          ...current,
          textures: {
            ...current.textures,
            [texture.id]: texture
          }
        };
      },
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary:
          ids.length === 1
            ? `Create ${next.textures[ids[0]].name} texture`
            : `Create ${ids.length} textures`,
        effects: {
          createdEntityIds: ids,
          changedEntityIds: [],
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
