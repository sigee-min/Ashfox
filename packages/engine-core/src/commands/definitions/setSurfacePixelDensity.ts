import {
  readCompiledParts
} from '../../modeling/partInvariants';
import {
  readPartRecipe
} from '../../modeling/partRecipe';
import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    density: {
      enum: [1, 2, 4],
      description:
        'Choose before creating model parts. The lattice density is immutable while parts exist.'
    }
  },
  required: ['density'],
  additionalProperties: false
} as const;

export const setSurfacePixelDensityCommand = defineCommand({
  name: 'textures.density.set',
  label: 'Set surface pixel density',
  purpose:
    'Choose the project 1×, 2×, or 4× square-pixel lattice before model parts exist.',
  inputSchema,
  apply: (document, payload) => {
    const densityChanged =
      document.settings.surfacePixelDensity !== payload.density;
    if (densityChanged) {
      const recipe = readPartRecipe(document);
      if (!recipe.ok) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message: 'Canonical modeling recipe is invalid.',
            path: recipe.issues[0]?.path ?? 'modeling',
            pathScope: 'document'
          }
        };
      }
      const compiled = readCompiledParts(document);
      if (!compiled.ok) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message: 'Existing compiled model violates part invariants.',
            path: compiled.issues[0]?.path ?? 'scene.parts',
            pathScope: 'document'
          }
        };
      }
      if (recipe.recipe !== null || compiled.parts.size > 0) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message:
              'Surface density is part of the compiled model lattice and cannot change while model parts exist.',
            path: 'payload.density',
            expected:
              'set density before model.parts.upsert, or delete all parts before selecting a new density'
          }
        };
      }
    }
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
