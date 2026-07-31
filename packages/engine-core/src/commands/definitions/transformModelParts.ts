import {
  translatePartRecipeSubtree
} from '../../modeling/partRecipeTransforms';
import {
  readPartRecipe
} from '../../modeling/partRecipe';
import { defineCommand } from '../definition';
import { modelPartsTransformSchema } from './modelPartSchemas';
import { reprojectPartRecipe } from './reprojectPartRecipe';

export const transformModelPartsCommand = defineCommand({
  name: 'model.parts.transform',
  label: 'Translate model part subtree',
  purpose:
    'Translate one canonical part subtree and reproject tolerant joins into deterministic single-owner geometry.',
  inputSchema: modelPartsTransformSchema,
  apply: (document, payload) => {
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
    const transformed = translatePartRecipeSubtree(
      current.recipe,
      {
        rootPartId: payload.rootPartId,
        translation: payload.by
      }
    );
    if (!transformed.ok) {
      const issue = transformed.issues[0];
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            issue?.message ??
            'Part subtree cannot be translated.',
          path: issue
            ? issue.path.startsWith('modeling.')
              ? 'payload.by'
              : `payload.${issue.path}`
            : 'payload.rootPartId',
          expected: 'an existing canonical part subtree'
        }
      };
    }
    const projected = reprojectPartRecipe(
      document,
      transformed.recipe
    );
    if (!projected.ok) {
      const failure = projected.failure;
      const documentFailure =
        failure.code === 'invalid_existing_model';
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: failure.message,
          path: documentFailure
            ? failure.path
            : 'payload.by',
          pathScope: documentFailure
            ? 'document'
            : 'operation',
          expected:
            'a translated subtree that remains connected and visible after canonical seam ownership'
        }
      };
    }
    return {
      ok: true,
      value: {
        document: projected.document,
        summary:
          `Translate ${transformed.affectedPartIds.length} model part` +
          `${transformed.affectedPartIds.length === 1 ? '' : 's'} ` +
          `by [${payload.by.join(',')}] lattice units`,
        effects: {
          createdEntityIds: [
            ...(projected.createdTextureId
              ? [projected.createdTextureId]
              : []),
            ...projected.createdIds
          ],
          changedEntityIds: projected.recipeChanged
            ? [...projected.changedIds, document.id]
            : projected.changedIds,
          removedEntityIds: projected.removedIds,
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
