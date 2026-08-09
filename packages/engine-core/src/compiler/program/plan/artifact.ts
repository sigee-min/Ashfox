import type { AuthoringFaceContract } from '../../../authoring/contract';
import type { ProjectIntent } from '../../../model';
import { resolveIntentProgramAppearanceBindings } from '../appearance/binding';
import { projectIntentProgramAuthoring } from './authoring';
import { finalizeIntentProgramGraph } from './graph';
import type { IntentProgramLoweringContext } from '../lower/context';
import { compileIntentProgramRecipe } from './recipe';
import type {
  CompileIntentProgramResult,
  IntentProgramLoweringInput
} from '../contract';

/** Seals the emitted context into the public immutable compiler artifact. */
export const assembleIntentProgramArtifactPlan = (
  context: IntentProgramLoweringContext,
  input: IntentProgramLoweringInput,
  intent: ProjectIntent,
  rootId: string,
  face: AuthoringFaceContract | null
): CompileIntentProgramResult => {
  const appearance = resolveIntentProgramAppearanceBindings(
    context, input.program, face, input.sourceMap
  );
  if (!appearance.ok) return appearance;
  const resolvedIntent: ProjectIntent = {
    ...intent,
    appearanceBindings: appearance.bindings
  };
  const recipe = compileIntentProgramRecipe(
    context.parts,
    input.sourceMap,
    input.program.appearance.palette
  );
  if (!recipe.ok) return recipe;
  return {
    ok: true,
    plan: {
      program: input.program,
      compilation: context.compilation,
      graph: { rootId, nodes: finalizeIntentProgramGraph(context) },
      projectIntent: resolvedIntent,
      authoring: projectIntentProgramAuthoring(
        input.program, resolvedIntent, context.slots, face
      ),
      recipe: recipe.recipe,
      attachmentReflections: context.attachmentReflections,
      motionTargetPartId: context.requireHost(
        context.compilation.motion.targetModuleId
      ).partId,
      sourceMap: input.sourceMap
    }
  };
};
