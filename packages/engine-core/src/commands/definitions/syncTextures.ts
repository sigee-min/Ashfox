import {
  resolveTextureSyncOptions,
  synchronizeTextureRecipes
} from '../../textures/textureRecipe';
import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    pixelsPerBlock: {
      type: 'number',
      minimum: 1,
      maximum: 256
    },
    padding: {
      type: 'number',
      minimum: 0,
      maximum: 32
    },
    maxResolution: {
      type: 'number',
      minimum: 16,
      maximum: 4096
    },
    seed: {
      type: 'number'
    },
    intensity: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    edge: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    noise: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    lightDir: {
      enum: ['tl_br', 'tr_bl', 'top_bottom', 'left_right']
    }
  },
  additionalProperties: false
} as const;

export const syncTexturesCommand = defineCommand({
  name: 'textures.sync',
  label: 'Synchronize textures',
  purpose:
    'Atomically rebuild generated UVs and directional base shading while preserving surface-anchored details.',
  inputSchema,
  apply: (document, payload) => {
    const options = resolveTextureSyncOptions(document, payload);
    const values = [
      options.pixelsPerBlock,
      options.padding,
      options.maxResolution,
      options.seed
    ];
    if (
      values.some((value) => !Number.isInteger(value)) ||
      values[2] <
        Math.max(
          document.settings.textureResolution.width,
          document.settings.textureResolution.height
        )
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message:
            'Texture density, padding, maximum resolution, and seed must be valid integers.',
          path: 'payload'
        }
      };
    }
    const result = synchronizeTextureRecipes(document, options);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: result.message,
          path: result.path,
          expected: result.expected
        }
      };
    }
    const changedEntityIds = [
      ...result.changedNodeIds,
      ...result.changedTextureIds
    ];
    const changed =
      result.changedSettings || changedEntityIds.length > 0;
    return {
      ok: true,
      value: {
        document: result.document,
        summary: !changed
          ? 'Keep synchronized textures'
          : (
              `Synchronized ${result.width} × ${result.height} textures at ` +
              `${result.pixelsPerBlock} px/block`
            ),
        effects: {
          createdEntityIds: [],
          changedEntityIds,
          removedEntityIds: [],
          invalidated: !changed
            ? []
            : ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
