import type { ProjectDocument } from '../../../model';
import {
  isPartBaseColor,
  isPartId,
  normalizePartSpecs,
  type PartAuthoringSpec,
  type PartMaterialDefinition,
  type PartSpec
} from '../../../modeling/partContract';
import {
  derivePartAttachments,
  inferFixedPartParents
} from '../../../modeling/partAttachmentDerivation';
import { completePartAuthoringSpec } from '../../../modeling/partAuthoring';
import { compilePartScene } from '../../../modeling/partCompiler';
import {
  normalizePartRecipe,
  readPartRecipe,
  withPartRecipe
} from '../../../modeling/partRecipe';
import { ensureGeneratedTexture } from '../../../textures/generatedMaterial';
import type { CommandApplicationResult } from '../../definition';
import type { CommandPayloadMap } from '../../types';

type UpsertPayload = CommandPayloadMap['model.parts.upsert'];
type ApplicationFailure = Extract<CommandApplicationResult, { ok: false }>;

interface CompletedParts {
  parts: readonly PartSpec[];
  existingParts: Map<string, PartSpec>;
  omittedParentPartIds: ReadonlySet<string>;
  partIndexById: ReadonlyMap<string, number>;
}

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const completeParts = (
  payload: UpsertPayload,
  existing: readonly PartSpec[]
): CompletedParts | ApplicationFailure => {
  const existingParts = new Map(
    existing.map((part) => [part.partId, part])
  );
  const omittedParentPartIds = new Set<string>();
  const partIndexById = new Map<string, number>();
  const authoredParts: PartAuthoringSpec[] = [];
  for (let index = 0; index < payload.parts.length; index += 1) {
    const part = payload.parts[index];
    partIndexById.set(part.partId, index);
    const existingPart = existingParts.get(part.partId);
    const sameKind = existingPart?.kind === part.kind;
    if (!sameKind) {
      const requiresExplicitParent =
        part.kind === 'feature' ||
        part.joint?.kind === 'hinge' ||
        part.joint?.kind === 'ball';
      if (
        requiresExplicitParent &&
        (!hasOwn(part, 'parentPartId') || part.parentPartId === null)
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
      sameKind ? existingPart : undefined
    );
    if (!completed.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: completed.issue.message,
          path: `payload.parts[${index}].${completed.issue.path}`,
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
  return {
    parts: normalized.value,
    existingParts,
    omittedParentPartIds,
    partIndexById
  };
};

const validateMaterials = (
  materials: readonly PartMaterialDefinition[]
): ApplicationFailure | null => {
  const materialIds = materials.map((material) => material.id);
  const invalidMaterial = materials.find(
    (material) =>
      !isPartId(material.id) ||
      !isPartBaseColor(material.baseColor)
  );
  const duplicateMaterialId = materialIds.find(
    (id, index) => materialIds.indexOf(id) !== index
  );
  return invalidMaterial || duplicateMaterialId
    ? {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: invalidMaterial
            ? 'Materials require a stable lowercase ID and #RRGGBB color.'
            : `Material ID "${duplicateMaterialId}" is duplicated.`,
          path: 'payload.materials',
          expected: 'unique material IDs with #RRGGBB base colors'
        }
      }
    : null;
};

const mergeMaterials = (
  incoming: readonly PartMaterialDefinition[],
  existing: readonly PartMaterialDefinition[]
): readonly PartMaterialDefinition[] | ApplicationFailure => {
  const existingMaterials = new Map(
    existing.map((material) => [material.id, material])
  );
  const conflictingMaterial = incoming.find((material) => {
    const current = existingMaterials.get(material.id);
    return (
      current !== undefined &&
      current.baseColor.toLowerCase() !== material.baseColor.toLowerCase()
    );
  });
  if (conflictingMaterial) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message: `Material "${conflictingMaterial.id}" already has a different base color.`,
        path: 'payload.materials',
        expected: 'use model.parts.material to change an existing color'
      }
    };
  }
  for (const material of incoming) {
    existingMaterials.set(material.id, material);
  }
  return [...existingMaterials.values()];
};

const compileParts = (
  document: ProjectDocument,
  parts: readonly PartSpec[],
  materials: readonly PartMaterialDefinition[],
  changedCount: number
): CommandApplicationResult => {
  const nextRecipe = normalizePartRecipe(parts, materials);
  if (!nextRecipe.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid_state',
        message: nextRecipe.issues[0]?.message ??
          'Combined modeling recipe is invalid.',
        path: 'payload.parts',
        expected: 'parts that form one valid canonical model with the existing recipe'
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
        expected: 'connected, visible lattice parts whose shallow seam intersections preserve each part and its attachment'
      }
    };
  }
  const projected = withPartRecipe(compiled.document, nextRecipe.recipe);
  const recipeChanged = projected !== compiled.document;
  return {
    ok: true,
    value: {
      document: projected,
      summary:
        `Compile ${changedCount} model part` +
        `${changedCount === 1 ? '' : 's'}`,
      effects: {
        createdEntityIds: [
          ...(setup.createdTextureId ? [setup.createdTextureId] : []),
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
};

export const applyUpsertModelParts = (
  document: ProjectDocument,
  payload: UpsertPayload
): CommandApplicationResult => {
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
  const completed = completeParts(
    payload,
    currentRecipe.recipe?.parts ?? []
  );
  if ('ok' in completed) return completed;
  const materials = payload.materials ?? [];
  const materialIssue = validateMaterials(materials);
  if (materialIssue) return materialIssue;

  for (const part of completed.parts) {
    completed.existingParts.set(part.partId, part);
  }
  const mergedMaterials = mergeMaterials(
    materials,
    currentRecipe.recipe?.materials ?? []
  );
  if ('ok' in mergedMaterials) return mergedMaterials;
  const inferred = inferFixedPartParents(
    [...completed.existingParts.values()],
    completed.omittedParentPartIds,
    document.settings.surfacePixelDensity
  );
  if (!inferred.ok) {
    const index = completed.partIndexById.get(inferred.partId) ?? 0;
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message: inferred.message,
        path: `payload.parts[${index}].parentPartId`,
        expected: 'exactly one geometric contact parent, or an explicit parentPartId'
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
        expected: 'project-space child geometry touching, shallowly intersecting, or within two lattice cells of its parent'
      }
    };
  }
  return compileParts(
    document,
    derived.parts,
    mergedMaterials,
    completed.parts.length
  );
};
