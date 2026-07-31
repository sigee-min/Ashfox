import {
  isPartBaseColor,
  isPartId,
  normalizePartSpecs
} from '../../modeling/partContract';
import {
  derivePartAttachments
} from '../../modeling/partAttachmentDerivation';
import {
  preserveExistingPartAuthoringDefaults
} from '../../modeling/partAuthoring';
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
import { modelPartsUpsertSchema } from './modelPartSchemas';

export const upsertModelPartsCommand = defineCommand({
  name: 'model.parts.upsert',
  label: 'Upsert model parts',
  purpose:
    'Compile project-space semantic parts with derived joints, shared-face pivots, shallow seam snapping, single-owner geometry, UVs, and generated texture surfaces.',
  inputSchema: modelPartsUpsertSchema,
  apply: (document, payload) => {
    const currentRecipe = readPartRecipe(document);
    if (!currentRecipe.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: currentRecipe.issues[0]?.message ??
            'Canonical modeling recipe is invalid.',
          path: currentRecipe.issues[0]?.path ?? 'modeling',
          pathScope: 'document'
        }
      };
    }
    const existingParts = new Map(
      (currentRecipe.recipe?.parts ?? []).map(
        (part) => [part.partId, part]
      )
    );
    const authoredParts = payload.parts.map((part) =>
      preserveExistingPartAuthoringDefaults(
        part,
        existingParts.get(part.partId)
      )
    );
    const normalized = normalizePartSpecs(authoredParts);
    if (!normalized.ok) {
      const issue = normalized.issues[0];
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: issue?.message ?? 'PartSpec payload is invalid.',
          path: issue
            ? `payload.parts${issue.path.slice(1)}`
            : 'payload.parts',
          expected: 'valid constrained PartSpec values'
        }
      };
    }
    const materials = payload.materials ?? [];
    const materialIds = materials.map((material) => material.id);
    const invalidMaterial = materials.find(
      (material) =>
        !isPartId(material.id) ||
        !isPartBaseColor(material.baseColor)
    );
    const duplicateMaterialId = materialIds.find(
      (id, index) => materialIds.indexOf(id) !== index
    );
    if (invalidMaterial || duplicateMaterialId) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: invalidMaterial
            ? 'Materials require a stable lowercase ID and #RRGGBB color.'
            : `Material ID "${duplicateMaterialId}" is duplicated.`,
          path: 'payload.materials',
          expected: 'unique material IDs with #RRGGBB base colors'
        }
      };
    }

    for (const part of normalized.value) {
      existingParts.set(part.partId, part);
    }
    const existingMaterials = new Map(
      (currentRecipe.recipe?.materials ?? []).map(
        (material) => [material.id, material]
      )
    );
    const conflictingMaterial = materials.find((material) => {
      const existing = existingMaterials.get(material.id);
      return (
        existing !== undefined &&
        existing.baseColor.toLowerCase() !==
          material.baseColor.toLowerCase()
      );
    });
    if (conflictingMaterial) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message:
            `Material "${conflictingMaterial.id}" already has a different base color.`,
          path: 'payload.materials',
          expected:
            'use model.parts.material to change an existing color'
        }
      };
    }
    for (const material of materials) {
      existingMaterials.set(material.id, material);
    }
    const derived = derivePartAttachments(
      [...existingParts.values()],
      document.settings.surfacePixelDensity
    );
    if (!derived.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: derived.message,
          path: `payload.${derived.path}`,
          pathScope: 'operation',
          expected:
            'project-space child geometry touching, shallowly intersecting, or within two lattice cells of its parent'
        }
      };
    }
    const nextRecipe = normalizePartRecipe(
      derived.parts,
      [...existingMaterials.values()]
    );
    if (!nextRecipe.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: nextRecipe.issues[0]?.message ??
            'Combined modeling recipe is invalid.',
          path: 'payload.parts',
          expected:
            'parts that form one valid canonical model with the existing recipe'
        }
      };
    }

    const setup = ensureGeneratedTexture(document);
    const compiled = compilePartScene(setup.document, {
      parts: nextRecipe.recipe.parts,
      materials: nextRecipe.recipe.materials,
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
              : 'operation',
          expected:
            'connected, visible lattice parts whose shallow seam intersections preserve each part and its attachment'
        }
      };
    }
    const projected = withPartRecipe(
      compiled.document,
      nextRecipe.recipe
    );
    const recipeChanged = projected !== compiled.document;
    return {
      ok: true,
      value: {
        document: projected,
        summary:
          `Compile ${normalized.value.length} model part` +
          `${normalized.value.length === 1 ? '' : 's'}`,
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
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
