import {
  readCompiledParts
} from '../../modeling/partInvariants';
import {
  normalizePartRecipe,
  readPartRecipe,
  withPartRecipe
} from '../../modeling/partRecipe';
import { compiledPartBoneId } from '../../modeling/provenance';
import { defineCommand } from '../definition';
import { modelPartsDeleteSchema } from './modelPartSchemas';
import { removeSceneNodes } from './removeSceneNodes';
import { reprojectPartRecipe } from './reprojectPartRecipe';

const descendantPartIds = (
  parentIds: ReadonlySet<string>,
  parentsByPart: ReadonlyMap<string, string | null>
): ReadonlySet<string> => {
  const removed = new Set(parentIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [partId, parentPartId] of parentsByPart) {
      if (
        parentPartId &&
        removed.has(parentPartId) &&
        !removed.has(partId)
      ) {
        removed.add(partId);
        changed = true;
      }
    }
  }
  return removed;
};

export const deleteModelPartsCommand = defineCommand({
  name: 'model.parts.delete',
  label: 'Delete model parts',
  purpose:
    'Delete generated parts, their part descendants, and dependent animation references atomically.',
  inputSchema: modelPartsDeleteSchema,
  apply: (document, payload) => {
    const recipeResult = readPartRecipe(document);
    if (!recipeResult.ok || recipeResult.recipe === null) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            recipeResult.ok
              ? 'Canonical modeling recipe does not exist.'
              : recipeResult.issues[0]?.message ??
                'Canonical modeling recipe is invalid.',
          path:
            recipeResult.ok
              ? 'modeling'
              : recipeResult.issues[0]?.path ?? 'modeling',
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
    const missingId = payload.partIds.find(
      (partId) => !compiled.parts.has(partId)
    );
    if (missingId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Compiled part "${missingId}" does not exist.`,
          path: 'payload.partIds',
          expected: 'existing compiled part IDs'
        }
      };
    }
    const removedPartIds = descendantPartIds(
      new Set(payload.partIds),
      new Map(
        recipeResult.recipe.parts.map((part) => [
          part.partId,
          part.parentPartId
        ])
      )
    );
    const removal = removeSceneNodes(
      document,
      [...removedPartIds]
        .sort()
        .map(compiledPartBoneId)
    );
    const retainedParts = recipeResult.recipe.parts.filter(
      (part) => !removedPartIds.has(part.partId)
    );
    let nextRecipe = null;
    if (retainedParts.length > 0) {
      const normalized = normalizePartRecipe(
        retainedParts,
        recipeResult.recipe.materials
      );
      if (!normalized.ok) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message: normalized.issues[0]?.message ??
              'Retained modeling recipe is invalid.',
            path: normalized.issues[0]?.path ?? 'modeling',
            pathScope: 'document'
          }
        };
      }
      nextRecipe = normalized.recipe;
    }
    const projected = nextRecipe === null
      ? null
      : reprojectPartRecipe(removal.document, nextRecipe);
    if (projected && !projected.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: projected.failure.message,
          path: projected.failure.path,
          pathScope:
            projected.failure.pathScope === 'document'
              ? 'document'
              : 'operation'
        }
      };
    }
    const nextDocument = projected?.ok
      ? projected.document
      : withPartRecipe(removal.document, null);
    return {
      ok: true,
      value: {
        document: nextDocument,
        summary:
          `Delete ${removedPartIds.size} model part` +
          `${removedPartIds.size === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: projected?.ok
            ? [
                ...(projected.createdTextureId
                  ? [projected.createdTextureId]
                  : []),
                ...projected.createdIds
              ]
            : [],
          changedEntityIds: [
            ...removal.changedEntityIds,
            ...(projected?.ok ? projected.changedIds : []),
            document.id
          ],
          removedEntityIds: [
            ...new Set([
              ...removal.removedEntityIds,
              ...(projected?.ok ? projected.removedIds : [])
            ])
          ],
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
