import { canonicalJsonString } from '../canonicalJson';
import { tokenizeIntentProgram } from './intentProgramLexing';
import { normalizeIntentProgram } from './intentProgramNormalization';
import { IntentProgramReader } from './intentProgramReader';
import type { IntentProgramParseResult } from './intentProgramTypes';

export { resolveIntentProgramSourceSpan } from './intentProgramTypes';
export type {
  IntentProgramAbsentFace,
  IntentProgramAst,
  IntentProgramAstField,
  IntentProgramAstStatement,
  IntentProgramAttachedModule,
  IntentProgramCoreModule,
  IntentProgramDiagnostic,
  IntentProgramFace,
  IntentProgramFocal,
  IntentProgramFullFace,
  IntentProgramIdleMotion,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramModuleExtension,
  IntentProgramPalette,
  IntentProgramParseResult,
  IntentProgramRest,
  IntentProgramSourceMap,
  IntentProgramSpan,
  IntentProgramStyle,
  IntentProgramSurface,
  IntentProgramSurfaceExtension
} from './intentProgramTypes';

const hashIntentProgram = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `intent:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

/** Parses the closed, coordinate-free Intent Program language. */
export const parseIntentProgram = (source: string): IntentProgramParseResult => {
  const lexical = tokenizeIntentProgram(source);
  const reader = new IntentProgramReader(lexical.tokens, lexical.diagnostics);
  reader.parse();
  const ir = reader.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ? null
    : normalizeIntentProgram(reader.raw, reader);
  const canonical = ir ? canonicalJsonString(ir) : null;
  return {
    source,
    ast: { statements: reader.statements },
    ir,
    canonical,
    hash: canonical ? hashIntentProgram(canonical) : null,
    diagnostics: reader.diagnostics,
    sourceMap: reader.sourceMap
  };
};
