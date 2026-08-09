import { canonicalJsonString } from '../../canonicalJson';
import { compareStableText } from '../../stableOrder';
import { tokenizeIntentProgram } from './lexer';
import { resolveIntentProgramConstraints } from './constraints';
import { IntentProgramReader } from './reader';
import { toIntentProgramSemanticAst } from './syntax';
import type { IntentProgramParseResult } from './types';

export {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
  INTENT_PROGRAM_LANGUAGE_VERSION
} from './language';

export { resolveIntentProgramSourceSpan } from './types';
export {
  collectIntentProgramConstraintIssues,
  resolveIntentProgramConstraints
} from './constraints';
export type {
  IntentProgramConstraintInspection,
  IntentProgramConstraintIssue,
  IntentProgramConstraintMetrics,
  IntentProgramConstraintReporter
} from './constraints';
export type {
  IntentProgramAbsentFace,
  IntentProgramAnimation,
  IntentProgramAppearance,
  IntentProgramAttachmentAnchor,
  IntentProgramAttachmentLane,
  IntentProgramAst,
  IntentProgramAstField,
  IntentProgramAttachedModule,
  IntentProgramCardinality,
  IntentProgramCoreModule,
  IntentProgramDiagnostic,
  IntentProgramDomain,
  IntentProgramEyeConfiguration,
  IntentProgramFace,
  IntentProgramFocal,
  IntentProgramFullFace,
  IntentProgramGaze,
  IntentProgramForwardDirection,
  IntentProgramGrowthDirection,
  IntentProgramIdleAnimation,
  IntentProgramIdleMode,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramModuleKind,
  IntentProgramPalette,
  IntentProgramParseResult,
  IntentProgramRootBlock,
  IntentProgramSemanticAst,
  IntentProgramSourceMap,
  IntentProgramSpan,
  IntentProgramSupport,
  IntentProgramSupportKind,
  IntentProgramSurface,
  IntentProgramSurfaceChord,
  IntentProgramSurfaceAxis,
  IntentProgramSurfaceEdge,
  IntentProgramSurfaceOffset,
  IntentProgramSurfaceShape,
  IntentProgramSurfaceSpan,
  IntentProgramSurfaceTip
} from './types';

/** Stable V1 hash for one canonical normalized Intent Program projection. */
export const hashIntentProgramCanonical = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `intent:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const sortIntentProgramDiagnostics = (
  diagnostics: readonly IntentProgramParseResult['diagnostics'][number][]
): readonly IntentProgramParseResult['diagnostics'][number][] =>
  [...diagnostics].sort((left, right) =>
    left.span.start.offset - right.span.start.offset ||
    left.span.end.offset - right.span.end.offset ||
    compareStableText(left.code, right.code) ||
    compareStableText(left.message, right.message)
  );

/** Parses the closed, coordinate-free Intent Program language. */
export const parseIntentProgram = (source: string): IntentProgramParseResult => {
  const lexical = tokenizeIntentProgram(source);
  const reader = new IntentProgramReader(lexical.tokens, lexical.diagnostics);
  reader.parse();
  const semanticAst = toIntentProgramSemanticAst(reader.raw);
  const resolved = resolveIntentProgramConstraints(semanticAst, reader);
  const ir = reader.hasErrors() ? null : resolved;
  const canonical = ir ? canonicalJsonString(ir) : null;
  return {
    source,
    ast: { statements: reader.statements },
    semanticAst,
    ir,
    canonical,
    hash: canonical ? hashIntentProgramCanonical(canonical) : null,
    diagnostics: sortIntentProgramDiagnostics(reader.diagnostics),
    sourceMap: reader.sourceMap
  };
};
