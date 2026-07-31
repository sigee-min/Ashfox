import {
  isPartBaseColor,
  isPartId,
  normalizePartSpecs,
  type PartAuthoringSpec
} from '../../modeling/partContract';
import {
  derivePartAttachments,
  inferFixedPartParents
} from '../../modeling/partAttachmentDerivation';
import {
  completePartAuthoringSpec
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

const hasOwn = (
  value: object,
  key: PropertyKey
): boolean => Object.prototype.hasOwnProperty.call(value, key);

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
    const omittedParentPartIds = new Set<string>();
    const partIndexById = new Map<string, number>();
    const authoredParts: PartAuthoringSpec[] = [];
    for (
      let index = 0;
      index < payload.parts.length;
      index += 1
    ) {
      const part = payload.parts[index];
      partIndexById.set(part.partId, index);
      const existing = existingParts.get(part.partId);
      const sameKind = existing?.kind === part.kind;
      if (!sameKind) {
        const requiresExplicitParent =
          part.kind === 'feature' ||
          part.joint?.kind === 'hinge' ||
          part.joint?.kind === 'ball';
        if (
          requiresExplicitParent &&
          (
            !hasOwn(part, 'parentPartId') ||
            part.parentPartId === null
          )
        ) {
          return {
            ok: false,
            error: {
              code: 'invalid_payload',
              message:
                part.kind === 'feature'
                  ? 'A new surface feature requires an explicit parentPartId.'
                  : 'A new articulated part requires an explicit parentPartId.',
              path: `payload.parts[${index}].parentPartId`,
              expected: 'an existing or same-batch parent part ID'
            }
          };
        }
        if (!hasOwn(part, 'parentPartId')) {
          omittedParentPartIds.add(part.partId);
        }
      }
      const completed = completePartAuthoringSpec(
        part,
        sameKind ? existing : undefined
      );
      if (!completed.ok) {
        return {
          ok: false,
          error: {
            code: 'invalid_payload',
            message: completed.issue.message,
            path:
              `payload.parts[${index}].${completed.issue.path}`,
            expected: 'one canonical geometry authority per field'
          }
        };
      }
      authoredParts.push(completed.value);
    }
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
    const inferred = inferFixedPartParents(
      [...existingParts.values()],
      omittedParentPartIds,
      document.settings.surfacePixelDensity
    );
    if (!inferred.ok) {
      const index = partIndexById.get(inferred.partId) ?? 0;
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: inferred.message,
          path: `payload.parts[${index}].parentPartId`,
          expected:
            'exactly one geometric contact parent, or an explicit parentPartId'
        }
      };
    }
    const derived = derivePartAttachments(
      inferred.parts,
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
