import {
  areLatticeCellSetsExactReflections,
  mirrorPartRecipeSubtree
} from '../../modeling/partRecipeTransforms';
import {
  readPartRecipe
} from '../../modeling/partRecipe';
import {
  readCompiledParts
} from '../../modeling/partInvariants';
import type {
  ProjectDocument
} from '../../model';
import { defineCommand } from '../definition';
import { modelPartsMirrorSchema } from './modelPartSchemas';
import { reprojectPartRecipe } from './reprojectPartRecipe';

const firstInexactMirrorPair = (
  document: ProjectDocument,
  payload: {
    axis: 'x' | 'y' | 'z';
    plane: number;
    partIdMap: readonly {
      sourcePartId: string;
      targetPartId: string;
    }[];
  }
): readonly [string, string] | null => {
  const compiled = readCompiledParts(document);
  if (!compiled.ok) return null;
  for (const mapping of payload.partIdMap) {
    const source = compiled.parts.get(mapping.sourcePartId);
    const target = compiled.parts.get(mapping.targetPartId);
    if (!source || !target) {
      return [mapping.sourcePartId, mapping.targetPartId];
    }
    if (!areLatticeCellSetsExactReflections(
      source.occupancy.cells,
      target.occupancy.cells,
      payload.axis,
      payload.plane
    )) {
      return [mapping.sourcePartId, mapping.targetPartId];
    }
  }
  return null;
};

export const mirrorModelPartsCommand = defineCommand({
  name: 'model.parts.mirror',
  label: 'Mirror model part subtree',
  purpose:
    'Mirror one canonical part subtree and reproject tolerant joins into deterministic single-owner geometry.',
  inputSchema: modelPartsMirrorSchema,
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
    const transformed = mirrorPartRecipeSubtree(
      current.recipe,
      payload
    );
    if (!transformed.ok) {
      const issue = transformed.issues[0];
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            issue?.message ??
            'Part subtree cannot be mirrored.',
          path: issue
            ? issue.path.startsWith('modeling.')
              ? 'payload.plane'
              : `payload.${issue.path}`
            : 'payload.rootPartId',
          expected:
            'one complete non-root subtree mapping to unused stable part IDs'
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
            : failure.code === 'id_collision'
              ? 'payload.partIdMap'
              : 'payload.plane',
          pathScope: documentFailure
            ? 'document'
            : 'operation',
          expected:
            'a reflected subtree that remains connected and visible after canonical seam ownership'
        }
      };
    }
    const inexactPair = firstInexactMirrorPair(
      projected.document,
      payload
    );
    if (inexactPair) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Mirrored parts "${inexactPair[0]}" and ` +
            `"${inexactPair[1]}" are not exact canonical lattice ` +
            'reflections after seam ownership. Keep paired parts ' +
            'from crossing the reflection plane or correct ' +
            'asymmetric surrounding seams.',
          path: 'payload.plane',
          expected:
            'source and target parts with exact reflected canonical occupancy and no positive-volume center-plane overlap'
        }
      };
    }
    return {
      ok: true,
      value: {
        document: projected.document,
        summary:
          `Mirror ${transformed.affectedPartIds.length} model part` +
          `${transformed.affectedPartIds.length === 1 ? '' : 's'} ` +
          `across ${payload.axis}=${payload.plane}`,
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
