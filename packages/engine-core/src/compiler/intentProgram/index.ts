export { compileIntentProgram } from './lowering';
export {
  materializeIntentProgram,
  type IntentProgramMaterializationError,
  type MaterializeIntentProgramResult
} from './materialize';
export { projectIntentProgramSemantics } from './semanticProjection';
export type {
  CompileIntentProgramResult,
  IntentProgramCompilerPlan,
  IntentProgramGraphNode,
  IntentProgramLoweringInput,
  IntentProgramStructuralGraph
} from './types';
