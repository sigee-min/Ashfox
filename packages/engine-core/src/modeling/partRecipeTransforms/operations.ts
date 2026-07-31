import { canonicalJsonString } from '../../canonicalJson';
import type { ConstrainedModelRecipe } from '../../model';
import { compareStableText } from '../../stableOrder';
import {
  isPartId,
  type PartSpec
} from '../partContract';
import { normalizePartRecipe } from '../partRecipe';
import {
  addVec3,
  reflectedFeature,
  reflectedPrimitive,
  reflectPoint,
  translatePrimitive
} from './geometry';
import { partSubtreeIds } from './graph';
import type {
  MirrorPartRecipeInput,
  PartRecipeTransformIssue,
  PartRecipeTransformResult,
  TranslatePartSubtreeInput
} from './types';

const normalizedResult = (
  parts: readonly PartSpec[],
  recipe: ConstrainedModelRecipe,
  affectedPartIds: readonly string[]
): PartRecipeTransformResult => {
  const normalized = normalizePartRecipe(parts, recipe.materials);
  if (!normalized.ok) {
    return {
      ok: false,
      issues: normalized.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    };
  }
  return {
    ok: true,
    recipe: normalized.recipe,
    affectedPartIds: [...affectedPartIds].sort(compareStableText)
  };
};

export const translatePartRecipeSubtree = (
  recipe: ConstrainedModelRecipe,
  input: TranslatePartSubtreeInput
): PartRecipeTransformResult => {
  const subtreeIds = partSubtreeIds(recipe, input.rootPartId);
  if (subtreeIds.length === 0) {
    return {
      ok: false,
      issues: [{
        path: 'rootPartId',
        message: `Canonical part "${input.rootPartId}" does not exist.`
      }]
    };
  }
  const selected = new Set(subtreeIds);
  const parts = recipe.parts.map((part): PartSpec => {
    if (!selected.has(part.partId)) return part;
    if (part.kind === 'feature') {
      return translatePrimitive(part, input.translation);
    }
    if (part.parentPartId === null) {
      return translatePrimitive(part, input.translation);
    }
    if (part.attachment === null) return part;
    return {
      ...part,
      attachment: {
        ...part.attachment,
        parentAnchor: addVec3(
          part.attachment.parentAnchor,
          input.translation
        )
      }
    };
  });
  return normalizedResult(parts, recipe, subtreeIds);
};

const validateMirrorMapping = (
  subtreeIds: readonly string[],
  input: MirrorPartRecipeInput
): {
  mappings: ReadonlyMap<string, string>;
  issues: readonly PartRecipeTransformIssue[];
} => {
  const issues: PartRecipeTransformIssue[] = [];
  const mappings = new Map<string, string>();
  const targets = new Set<string>();
  input.partIdMap.forEach((entry, index) => {
    const path = `partIdMap[${index}]`;
    if (!isPartId(entry.sourcePartId)) {
      issues.push({
        path: `${path}.sourcePartId`,
        message: 'Source part ID is invalid.'
      });
      return;
    }
    if (!isPartId(entry.targetPartId)) {
      issues.push({
        path: `${path}.targetPartId`,
        message: 'Target part ID is invalid.'
      });
      return;
    }
    if (mappings.has(entry.sourcePartId)) {
      issues.push({
        path: `${path}.sourcePartId`,
        message: `Source part "${entry.sourcePartId}" is mapped more than once.`
      });
    } else {
      mappings.set(entry.sourcePartId, entry.targetPartId);
    }
    if (targets.has(entry.targetPartId)) {
      issues.push({
        path: `${path}.targetPartId`,
        message: `Target part "${entry.targetPartId}" is used more than once.`
      });
    }
    targets.add(entry.targetPartId);
  });
  const subtree = new Set(subtreeIds);
  for (const sourcePartId of subtreeIds) {
    if (!mappings.has(sourcePartId)) {
      issues.push({
        path: 'partIdMap',
        message: `Explicit target ID is required for subtree part "${sourcePartId}".`
      });
    }
  }
  for (const sourcePartId of mappings.keys()) {
    if (!subtree.has(sourcePartId)) {
      issues.push({
        path: 'partIdMap',
        message: `Mapped source "${sourcePartId}" is outside the selected subtree.`
      });
    }
  }
  return { mappings, issues };
};

const mirroredParts = (
  recipe: ConstrainedModelRecipe,
  input: MirrorPartRecipeInput,
  subtreeIds: readonly string[],
  mappings: ReadonlyMap<string, string>
): readonly PartSpec[] => {
  const subtree = new Set(subtreeIds);
  return recipe.parts
    .filter((part) => subtree.has(part.partId))
    .map((part): PartSpec => {
      const targetPartId = mappings.get(part.partId)!;
      const reflected =
        part.kind === 'feature'
          ? reflectedFeature(part, input.axis, input.plane)
          : reflectedPrimitive(part, input.axis);
      const parentPartId =
        part.parentPartId !== null && subtree.has(part.parentPartId)
          ? mappings.get(part.parentPartId)!
          : part.parentPartId;
      if (reflected.kind === 'feature') {
        return {
          ...reflected,
          partId: targetPartId,
          parentPartId,
          attachment: null
        };
      }
      return {
        ...reflected,
        partId: targetPartId,
        parentPartId,
        attachment:
          part.attachment === null
            ? null
            : {
                parentAnchor: reflectPoint(
                  part.attachment.parentAnchor,
                  input.axis,
                  input.plane
                ),
                partAnchor: reflectPoint(
                  part.attachment.partAnchor,
                  input.axis,
                  0
                )
              }
      };
    });
};

const mergeMirroredParts = (
  recipe: ConstrainedModelRecipe,
  mirrored: readonly PartSpec[]
): PartRecipeTransformResult => {
  const existingTargets = mirrored.map((part) =>
    recipe.parts.find((candidate) => candidate.partId === part.partId)
  );
  if (existingTargets.some((part) => part !== undefined)) {
    if (existingTargets.some((part) => part === undefined)) {
      return {
        ok: false,
        issues: [{
          path: 'partIdMap',
          message: 'Only part of the deterministic mirror target subtree exists. Delete the conflicting target subtree before retrying.'
        }]
      };
    }
    const mismatchIndex = mirrored.findIndex(
      (part, index) =>
        canonicalJsonString(part) !==
        canonicalJsonString(existingTargets[index] ?? null)
    );
    if (mismatchIndex < 0) {
      return normalizedResult(
        recipe.parts,
        recipe,
        mirrored.map((part) => part.partId)
      );
    }
    const targetPartId = mirrored[mismatchIndex].partId;
    return {
      ok: false,
      issues: [{
        path: 'partIdMap',
        message: `Target part "${targetPartId}" already exists with different canonical content.`
      }]
    };
  }
  return normalizedResult(
    [...recipe.parts, ...mirrored],
    recipe,
    mirrored.map((part) => part.partId)
  );
};

export const mirrorPartRecipeSubtree = (
  recipe: ConstrainedModelRecipe,
  input: MirrorPartRecipeInput
): PartRecipeTransformResult => {
  const subtreeIds = partSubtreeIds(recipe, input.rootPartId);
  if (subtreeIds.length === 0) {
    return {
      ok: false,
      issues: [{
        path: 'rootPartId',
        message: `Canonical part "${input.rootPartId}" does not exist.`
      }]
    };
  }
  const sourceRoot = recipe.parts.find(
    (part) => part.partId === input.rootPartId
  );
  if (sourceRoot?.parentPartId === null) {
    return {
      ok: false,
      issues: [{
        path: 'rootPartId',
        message: 'The one canonical root cannot be copied because that would create a second model root.'
      }]
    };
  }
  const validation = validateMirrorMapping(subtreeIds, input);
  if (validation.issues.length > 0) {
    return { ok: false, issues: validation.issues };
  }
  return mergeMirroredParts(
    recipe,
    mirroredParts(recipe, input, subtreeIds, validation.mappings)
  );
};
