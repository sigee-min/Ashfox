import type { ProjectIntent } from '../../../model';
import { assembleIntentProgramArtifactPlan } from '../plan/artifact';
import { emitIntentProgramBody } from './body/emit';
import { createIntentProgramLoweringContext } from './context';
import { emitIntentProgramPresentation } from './presentation';
import { realizeIntentProgramSupport } from '../support';
import type {
  CompileIntentProgramResult,
  IntentProgramCompilationPlan,
  IntentProgramLoweringInput
} from '../contract';

/** Coordinates independent geometry stages over one encapsulated context. */
export const lowerIntentProgramGeometry = (
  input: IntentProgramLoweringInput,
  intent: ProjectIntent,
  compilation: IntentProgramCompilationPlan
): CompileIntentProgramResult => {
  const context = createIntentProgramLoweringContext(
    input.program,
    compilation,
    intent
  );
  const body = emitIntentProgramBody(context, input, compilation);
  if (!body.ok) return body;

  const presentation = emitIntentProgramPresentation(
    context,
    input,
    body.rootHost
  );
  if (!presentation.ok) return presentation;

  const support = realizeIntentProgramSupport(context, input);
  if (!support.ok) return support;

  return assembleIntentProgramArtifactPlan(
    context,
    input,
    intent,
    body.root.id,
    presentation.face
  );
};
