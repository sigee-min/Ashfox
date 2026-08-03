import type {
  ConstrainedModelRecipe,
  ProjectDocument
} from '../../model';
import {
  compilePartScene,
  type CompilePartSceneFailure
} from '../../modeling/partCompiler';
import { derivePartAttachments } from '../../modeling/partAttachmentDerivation';
import { withPartRecipe } from '../../modeling/partRecipe';
import {
  ensureGeneratedTexture
} from '../../textures/generatedMaterial';

export type ReprojectPartRecipeResult =
  | {
      ok: true;
      document: ProjectDocument;
      createdTextureId: string | null;
      createdIds: readonly string[];
      changedIds: readonly string[];
      removedIds: readonly string[];
      recipeChanged: boolean;
    }
  | {
      ok: false;
      failure: CompilePartSceneFailure;
    };

export const reprojectPartRecipe = (
  document: ProjectDocument,
  recipe: ConstrainedModelRecipe
): ReprojectPartRecipeResult => {
  const attachments = derivePartAttachments(
    recipe.parts,
    document.settings.surfacePixelDensity
  );
  if (!attachments.ok) {
    return {
      ok: false,
      failure: {
        ok: false,
        code: 'geometry',
        path: attachments.path,
        pathScope: 'payload',
        message: attachments.message
      }
    };
  }
  const setup = ensureGeneratedTexture(document);
  const compiled = compilePartScene(setup.document, {
    parts: attachments.parts,
    materials: recipe.materials,
    textureId: setup.textureId
  });
  if (!compiled.ok) {
    return {
      ok: false,
      failure: compiled
    };
  }
  const projectedRecipe: ConstrainedModelRecipe = {
    ...recipe,
    parts: compiled.projectedParts
  };
  const projected = withPartRecipe(compiled.document, projectedRecipe);
  return {
    ok: true,
    document: projected,
    createdTextureId: setup.createdTextureId,
    createdIds: compiled.createdIds,
    changedIds: compiled.changedIds,
    removedIds: compiled.removedIds,
    recipeChanged: projected !== compiled.document
  };
};
