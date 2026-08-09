import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramSpan
} from '../../project/intentProgramTypes';
import { validateModuleGraph } from './moduleGraphValidation';
import { validateModuleTopology } from './moduleTopologyValidation';
import { validateIntentProgramInput } from './inputValidation';

/**
 * The compiler validates source topology before lowering: body graph first,
 * then its support, face, focal, and surface consumers.
 */
export const validateIntentProgramModules = (
  program: IntentProgramIr,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): readonly IntentProgramDiagnostic[] => {
  const inputDiagnostics = validateIntentProgramInput(program, sourceMap);
  if (inputDiagnostics.length > 0) return inputDiagnostics;
  const context = validateModuleGraph(program, sourceMap);
  validateModuleTopology(
    program,
    context.modules,
    sourceMap,
    context.diagnostics
  );
  return context.diagnostics;
};
