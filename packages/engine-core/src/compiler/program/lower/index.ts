import { lowerIntentProgramGeometry } from './geometry';
import { validateIntentProgramInput } from '../input';
import { planIntentProgram } from '../plan';
import { projectIntentProgramSemantics } from '../plan/semantic';
import type {
  CompileIntentProgramResult,
  IntentProgramLoweringInput
} from '../contract';

/**
 * Public compiler pipeline. Each stage consumes the successful value from the
 * previous stage; only geometry lowering owns a mutable, encapsulated context.
 */
export const compileIntentProgram = (
  input: IntentProgramLoweringInput
): CompileIntentProgramResult => {
  const diagnostics = validateIntentProgramInput(input.program, input.sourceMap);
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const semantic = projectIntentProgramSemantics(input.program);
  const planning = planIntentProgram(input.program);

  return lowerIntentProgramGeometry(input, semantic, planning);
};
