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
import { compareStableText } from '../../stableOrder';
import { defineCommand } from '../definition';
import { modelPartsMaterialSchema } from './modelPartSchemas';

const canonicalColor = (color: string): string =>
  color.toUpperCase();

const materialForColor = (
  materials: readonly { id: string; baseColor: string }[],
  color: string
): { id: string; baseColor: string } | undefined =>
  materials
    .filter(
      (material) =>
        canonicalColor(material.baseColor) === canonicalColor(color)
    )
    .sort((left, right) => compareStableText(left.id, right.id))[0];

const deriveMaterialId = (
  materials: readonly { id: string }[],
  color: string
): string => {
  const used = new Set(materials.map((material) => material.id));
  const base = `material.${color.slice(1).toLowerCase()}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}.${suffix}`)) suffix += 1;
  return `${base}.${suffix}`;
};

export const setModelPartMaterialCommand = defineCommand({
  name: 'model.parts.material',
  label: 'Set part material',
  purpose:
    'Assign one canonical material ID and base color to complete generated parts.',
  inputSchema: modelPartsMaterialSchema,
  apply: (document, payload) => {
    if (
      (
        payload.materialId !== undefined &&
        !isPartId(payload.materialId)
      ) ||
      (
        payload.baseColor !== undefined &&
        !isPartBaseColor(payload.baseColor)
      )
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message:
            'Material ID must be stable lowercase text and color must be #RRGGBB.',
          path:
            payload.materialId !== undefined &&
            !isPartId(payload.materialId)
              ? 'payload.materialId'
              : 'payload.baseColor',
          expected: 'lowercase ID or #RRGGBB base color'
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
    const missingIndex = payload.partIds.findIndex(
      (partId) =>
        !current.recipe?.parts.some(
          (part) => part.partId === partId
        )
    );
    if (missingIndex >= 0) {
      const missingId = payload.partIds[missingIndex];
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Compiled part "${missingId}" does not exist.`,
          path: `payload.partIds[${missingIndex}]`,
          expected: 'existing canonical part IDs'
        }
      };
    }
    const requestedMaterial =
      payload.materialId === undefined
        ? undefined
        : current.recipe.materials.find(
            (material) => material.id === payload.materialId
          );
    if (
      payload.materialId !== undefined &&
      payload.baseColor === undefined &&
      requestedMaterial === undefined
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message:
            `Material "${payload.materialId}" does not exist, so its color cannot be reused.`,
          path: 'payload.materialId',
          expected: 'an existing material ID or a baseColor'
        }
      };
    }

    const requestedColor =
      payload.baseColor === undefined
        ? requestedMaterial?.baseColor
        : canonicalColor(payload.baseColor);
    if (requestedColor === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'A material color could not be resolved.',
          path: 'payload.baseColor',
          expected: '#RRGGBB'
        }
      };
    }
    const changesRequestedMaterial =
      requestedMaterial !== undefined &&
      canonicalColor(requestedMaterial.baseColor) !== requestedColor;
    const hasUnselectedRequestedUser =
      requestedMaterial !== undefined &&
      current.recipe.parts.some(
        (part) =>
          !selected.has(part.partId) &&
          part.materialId === requestedMaterial.id
      );
    const mustFork =
      changesRequestedMaterial && hasUnselectedRequestedUser;
    const matchingMaterial = materialForColor(
      current.recipe.materials,
      requestedColor
    );
    const resolvedMaterialId =
      payload.materialId === undefined
        ? matchingMaterial?.id ??
          deriveMaterialId(current.recipe.materials, requestedColor)
        : mustFork
          ? matchingMaterial?.id ??
            deriveMaterialId(current.recipe.materials, requestedColor)
          : payload.materialId;

    const nextParts = current.recipe.parts.map((part) =>
      selected.has(part.partId)
        ? {
            ...part,
            materialId: resolvedMaterialId
          }
        : part
    );
    const nextMaterials = [
      ...current.recipe.materials.filter(
        (material) => material.id !== resolvedMaterialId
      ),
      {
        id: resolvedMaterialId,
        baseColor: requestedColor
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
          `Set material ${resolvedMaterialId} on ` +
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
