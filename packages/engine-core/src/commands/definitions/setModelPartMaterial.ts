import {
  isPartBaseColor,
  isPartId
} from '../../modeling/partContract';
import {
  compilePartScene
} from '../../modeling/partCompiler';
import {
  normalizePartRecipe,
  readPartRecipe,
  withPartRecipe
} from '../../modeling/partRecipe';
import {
  ensureGeneratedTexture
} from '../../textures/generatedMaterial';
import { defineCommand } from '../definition';
import { modelPartsMaterialSchema } from './modelPartSchemas';

export const setModelPartMaterialCommand = defineCommand({
  name: 'model.parts.material',
  label: 'Set part material',
  purpose:
    'Assign one canonical material ID and base color to complete generated parts.',
  inputSchema: modelPartsMaterialSchema,
  apply: (document, payload) => {
    if (
      !isPartId(payload.materialId) ||
      !isPartBaseColor(payload.baseColor)
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Material requires a stable ID and #RRGGBB base color.',
          path: 'payload.materialId',
          expected: 'lowercase ID and #RRGGBB base color'
        }
      };
    }
    const current = readPartRecipe(document);
    if (!current.ok || current.recipe === null) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            current.ok
              ? 'Canonical modeling recipe does not exist.'
              : current.issues[0]?.message ??
                'Canonical modeling recipe is invalid.',
          path:
            current.ok
              ? 'modeling'
              : current.issues[0]?.path ?? 'modeling',
          pathScope: 'document'
        }
      };
    }
    const selected = new Set(payload.partIds);
    const missingId = payload.partIds.find(
      (partId) =>
        !current.recipe?.parts.some(
          (part) => part.partId === partId
        )
    );
    if (missingId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Compiled part "${missingId}" does not exist.`,
          path: 'payload.partIds',
          expected: 'existing canonical part IDs'
        }
      };
    }
    const existingMaterial = current.recipe.materials.find(
      (material) => material.id === payload.materialId
    );
    const unselectedUser = current.recipe.parts.find(
      (part) =>
        !selected.has(part.partId) &&
        part.materialId === payload.materialId
    );
    if (
      existingMaterial &&
      unselectedUser &&
      existingMaterial.baseColor.toLowerCase() !==
        payload.baseColor.toLowerCase()
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Material "${payload.materialId}" is still used by unselected parts.`,
          path: 'payload.baseColor',
          expected: existingMaterial.baseColor
        }
      };
    }

    const nextParts = current.recipe.parts.map((part) =>
      selected.has(part.partId)
        ? {
            ...part,
            materialId: payload.materialId
          }
        : part
    );
    const nextMaterials = [
      ...current.recipe.materials.filter(
        (material) => material.id !== payload.materialId
      ),
      {
        id: payload.materialId,
        baseColor: payload.baseColor
      }
    ];
    const normalized = normalizePartRecipe(
      nextParts,
      nextMaterials
    );
    if (!normalized.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: normalized.issues[0]?.message ??
            'Updated modeling recipe is invalid.',
          path: 'payload.partIds',
          expected: 'a valid complete material reassignment'
        }
      };
    }
    const setup = ensureGeneratedTexture(document);
    const compiled = compilePartScene(setup.document, {
      parts: normalized.recipe.parts,
      materials: normalized.recipe.materials,
      textureId: setup.textureId
    });
    if (!compiled.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: compiled.message,
          path:
            compiled.pathScope === 'document'
              ? compiled.path
              : `payload.${compiled.path}`,
          pathScope:
            compiled.pathScope === 'document'
              ? 'document'
              : 'operation'
        }
      };
    }
    const projected = withPartRecipe(
      compiled.document,
      normalized.recipe
    );
    const recipeChanged = projected !== compiled.document;
    return {
      ok: true,
      value: {
        document: projected,
        summary:
          `Set material ${payload.materialId} on ` +
          `${payload.partIds.length} part` +
          `${payload.partIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [
            ...(setup.createdTextureId
              ? [setup.createdTextureId]
              : []),
            ...compiled.createdIds
          ],
          changedEntityIds: recipeChanged
            ? [...compiled.changedIds, document.id]
            : compiled.changedIds,
          removedEntityIds: compiled.removedIds,
          invalidated: [
            'scene',
            'textures',
            'uv',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
