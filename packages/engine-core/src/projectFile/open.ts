import { isCanonicalIsoDate } from '@ashfox/internal-contracts';

import { compareStableText } from '../stableOrder';
import { compileIntentProgram } from '../compiler/program';
import {
  materializeCompiledIntentProgram
} from '../compiler/program/materialize';
import {
  intentProgramOutputDigest
} from '../provenance/program';
import {
  createIntentProgramSourceV1FromDigest
} from '../provenance/program/receipt';
import type { ProjectDocument } from '../model';
import { createProjectDocument } from '../project/create';
import {
  INTENT_PROGRAM_SOURCE_MAX_LENGTH
} from '../project/program/language';
import {
  parseIntentProgram,
  resolveIntentProgramSourceSpan,
  type IntentProgramDiagnostic,
  type IntentProgramParseResult,
  type IntentProgramSpan
} from '../project/program';
import { intentProgramSpan } from '../project/program/lexer';
import {
  attestIntentProgramCandidate,
  DEFAULT_INTENT_VALIDATION_COMPUTATION,
  type IntentProgramValidationComputation
} from '../validation/project/candidate';
import {
  validateProjectDocumentCandidate
} from '../validation/project/validate';
import type {
  OpenProjectFileInput,
  OpenProjectFileResult
} from './contract';

const fallbackSpan: IntentProgramSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 }
};

const sortedDiagnostics = (
  diagnostics: readonly IntentProgramDiagnostic[]
): readonly IntentProgramDiagnostic[] => Object.freeze(
  [...diagnostics].sort((left, right) =>
    left.span.start.offset - right.span.start.offset ||
    left.span.end.offset - right.span.end.offset ||
    compareStableText(left.code, right.code) ||
    compareStableText(left.message, right.message)
  )
);

const failure = (
  diagnostics: readonly IntentProgramDiagnostic[]
): OpenProjectFileResult => Object.freeze({
  ok: false,
  diagnostics: sortedDiagnostics(diagnostics)
});

const diagnostic = (
  code: string,
  message: string,
  span: IntentProgramSpan = fallbackSpan
): IntentProgramDiagnostic => ({
  severity: 'error',
  code,
  message,
  span
});

const materializationSpan = (
  parsed: IntentProgramParseResult,
  path: string
): IntentProgramSpan => {
  const location = /^intentProgram\.source:(\d+):(\d+)$/.exec(path);
  if (location) {
    const line = Number(location[1]);
    const column = Number(location[2]);
    const lines = parsed.source.split('\n');
    let offset = 0;
    for (let index = 1; index < line; index += 1) {
      offset += (lines[index - 1]?.length ?? 0) + 1;
    }
    offset += Math.max(0, column - 1);
    return intentProgramSpan(parsed.source, offset, offset);
  }
  return resolveIntentProgramSourceSpan(parsed.sourceMap, path) ??
    parsed.sourceMap.name ?? fallbackSpan;
};

const invalidIdentity = (
  input: OpenProjectFileInput,
  message: string
): OpenProjectFileResult => failure([diagnostic(
  'project-file.invalid_identity',
  message,
  intentProgramSpan(input.source, 0, 0)
)]);

const createSeed = (
  input: OpenProjectFileInput,
  name: string
): ProjectDocument | null => {
  const { id, revision, createdAt } = input.identity;
  if (
    id.trim() !== id || id.length === 0 ||
    revision.trim() !== revision || revision.length === 0 ||
    !isCanonicalIsoDate(createdAt)
  ) return null;
  try {
    return createProjectDocument({
      id,
      name,
      revision,
      createdAt
    });
  } catch {
    return null;
  }
};

/** Internal seam used to prove source-file open performs each expensive stage once. */
export interface ProjectFileOpenComputation {
  readonly compile: typeof compileIntentProgram;
  readonly materialize: typeof materializeCompiledIntentProgram;
  readonly outputDigest: typeof intentProgramOutputDigest;
  readonly validation: IntentProgramValidationComputation;
}

const DEFAULT_PROJECT_FILE_OPEN_COMPUTATION: ProjectFileOpenComputation =
  Object.freeze({
    compile: compileIntentProgram,
    materialize: materializeCompiledIntentProgram,
    outputDigest: intentProgramOutputDigest,
    validation: DEFAULT_INTENT_VALIDATION_COMPUTATION
  });

/** Compiles one source-only `.ashfox` file atomically into a fresh runtime. */
export const openProjectFileWithComputation = (
  input: OpenProjectFileInput,
  computation: ProjectFileOpenComputation
): OpenProjectFileResult => {
  if (!input || typeof input.source !== 'string') {
    return failure([diagnostic(
      'project-file.invalid_source',
      'Project file source must be UTF-8 text.'
    )]);
  }
  if (
    !input.identity ||
    typeof input.identity.id !== 'string' ||
    typeof input.identity.revision !== 'string' ||
    typeof input.identity.createdAt !== 'string'
  ) {
    return failure([diagnostic(
      'project-file.invalid_identity',
      'Project file identity requires id, revision, and creation timestamp.'
    )]);
  }
  if (input.source.length > INTENT_PROGRAM_SOURCE_MAX_LENGTH) {
    return failure([diagnostic(
      'intent.source_too_long',
      `Intent Program source must not exceed ${INTENT_PROGRAM_SOURCE_MAX_LENGTH} characters.`,
      intentProgramSpan(
        input.source,
        INTENT_PROGRAM_SOURCE_MAX_LENGTH,
        input.source.length
      )
    )]);
  }
  const parsed = parseIntentProgram(input.source);
  const parseErrors = parsed.diagnostics.filter((entry) =>
    entry.severity === 'error'
  );
  if (
    parseErrors.length > 0 ||
    !parsed.ir || !parsed.canonical || !parsed.hash
  ) return failure(parsed.diagnostics);

  const compiled = computation.compile({
    program: parsed.ir,
    sourceMap: parsed.sourceMap
  });
  if (!compiled.ok) {
    return failure([...parsed.diagnostics, ...compiled.diagnostics]);
  }
  const seed = createSeed(input, parsed.ir.name);
  if (!seed) {
    return invalidIdentity(
      input,
      'Project file identity requires non-empty id, revision, and canonical creation timestamp.'
    );
  }
  const candidateSource = { source: input.source, hash: parsed.hash };
  const materialized = computation.materialize(
    seed,
    candidateSource,
    compiled.plan
  );
  if (!materialized.ok) {
    return failure([
      ...parsed.diagnostics,
      diagnostic(
        'project-file.materialization_failed',
        materialized.error.message,
        materializationSpan(parsed, materialized.error.path)
      )
    ]);
  }
  const outputDigest = computation.outputDigest(materialized.document);
  const authority = createIntentProgramSourceV1FromDigest(
    candidateSource,
    parsed.canonical,
    outputDigest
  );
  const document: ProjectDocument = {
    ...materialized.document,
    intentProgram: authority
  };
  const attestation = attestIntentProgramCandidate(
    materialized.document,
    document,
    authority.receipt.sourceDigest,
    outputDigest
  );
  if (!attestation) {
    return failure([
      ...parsed.diagnostics,
      diagnostic(
        'project-file.attestation_failed',
        'Compiler output could not bind its ephemeral validation evidence.',
        parsed.sourceMap.name ?? fallbackSpan
      )
    ]);
  }
  const report = validateProjectDocumentCandidate(
    document,
    attestation,
    computation.validation
  );
  const invalid = report.findings.filter((finding) =>
    finding.severity === 'error'
  );
  if (invalid.length > 0) {
    return failure([
      ...parsed.diagnostics,
      ...invalid.map((finding) => diagnostic(
        finding.code,
        finding.message,
        materializationSpan(parsed, finding.path)
      ))
    ]);
  }
  return Object.freeze({
    ok: true,
    document,
    diagnostics: sortedDiagnostics(parsed.diagnostics)
  });
};

/** Compiles one source-only `.ashfox` file atomically into a fresh runtime. */
export const openProjectFile = (
  input: OpenProjectFileInput
): OpenProjectFileResult => openProjectFileWithComputation(
  input,
  DEFAULT_PROJECT_FILE_OPEN_COMPUTATION
);
