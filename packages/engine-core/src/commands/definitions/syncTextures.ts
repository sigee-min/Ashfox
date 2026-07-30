import {
  synchronizeGeneratedTextures
} from '../../textures/textureRecipe';
import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
} as const;

export const syncTexturesCommand = defineCommand({
  name: 'textures.sync',
  label: 'Synchronize textures',
  purpose:
    'Pack one fixed-density atlas and derive Minecraft face shades.',
  inputSchema,
  apply: (document) => {
    const result = synchronizeGeneratedTextures(document);
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
              `Synchronized ${result.width} × ${result.height} atlas at ` +
              `${result.texelsPerModelUnit} texel/model-unit`
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
