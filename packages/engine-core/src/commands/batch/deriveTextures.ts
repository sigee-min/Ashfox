import type { ProjectDocument } from '../../model';
import { deriveGeneratedTextures } from '../../textures/textureRecipe';
import type {
  CommandBatchFailure,
  CommandEffects
} from '../types';
import { mergeCommandEffects } from './effects';
import { commandBatchFailure } from './failure';

export type DerivedBatchTextures =
  | {
      ok: true;
      document: ProjectDocument;
      effects: CommandEffects;
    }
  | CommandBatchFailure;

export const deriveBatchTextures = (
  originalDocument: ProjectDocument,
  document: ProjectDocument,
  effects: CommandEffects
): DerivedBatchTextures => {
  const derived = deriveGeneratedTextures(document);
  if (!derived.ok) {
    return commandBatchFailure(originalDocument, {
      code: 'invalid_state',
      message: derived.message,
      path: derived.path,
      expected: derived.expected
    });
  }
  const changedEntityIds = [
    ...derived.changedNodeIds,
    ...derived.changedTextureIds
  ];
  const changed =
    derived.changedSettings || changedEntityIds.length > 0;
  return {
    ok: true,
    document: derived.document,
    effects: changed
      ? mergeCommandEffects(effects, {
          createdEntityIds: [],
          changedEntityIds,
          removedEntityIds: [],
          invalidated: [
            'scene',
            'textures',
            'uv',
            'validation',
            'preview'
          ]
        })
      : effects
  };
};
