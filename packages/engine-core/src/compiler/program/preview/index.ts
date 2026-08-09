import type {
  IntentProgramSource,
  ProjectDocument
} from '../../../model';
import {
  intentProgramOutputDigest,
  readIntentProgramSource,
  validateIntentProgramReceipt
} from '../../../provenance/program';
import { parseIntentProgram } from '../../../project/program';
import {
  resolveIntentProgramSourceSpan,
  type IntentProgramDiagnostic,
  type IntentProgramParseResult,
  type IntentProgramSpan
} from '../../../project/program/types';
import { compileIntentProgram } from '../lower';
import { materializeIntentProgram } from '../materialize';

/** A diagnostic owned by the supplied pending source, never canonical state. */
export interface IntentProgramPreviewDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  /** Path relative to the supplied IntentProgramSource record. */
  readonly path: string;
  readonly span?: IntentProgramSpan;
}

export interface IntentProgramPreviewView {
  /** Ephemeral compiler output. It is not installed into the input document. */
  readonly candidateDocument: Readonly<ProjectDocument>;
  readonly sourceDigest: string;
  readonly outputDigest: string;
}

export type PreviewIntentProgramResult =
  | {
      readonly ok: true;
      readonly preview: IntentProgramPreviewView;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly IntentProgramPreviewDiagnostic[];
    };

export interface IntentProgramDiagnosticReport {
  readonly ok: boolean;
  readonly diagnostics: readonly IntentProgramPreviewDiagnostic[];
}

const sourceDiagnostic = (
  code: string,
  message: string,
  path: string,
  span?: IntentProgramSpan
): IntentProgramPreviewDiagnostic => ({
  severity: 'error',
  code,
  message,
  path,
  ...(span ? { span } : {})
});

const compilerDiagnostic = (
  diagnostic: IntentProgramDiagnostic
): IntentProgramPreviewDiagnostic => ({
  severity: diagnostic.severity,
  code: diagnostic.code,
  message: diagnostic.message,
  path: 'source',
  span: diagnostic.span
});

const compileDiagnostics = (
  parsed: IntentProgramParseResult
): readonly IntentProgramPreviewDiagnostic[] => {
  const parsedDiagnostics = parsed.diagnostics.map(compilerDiagnostic);
  if (
    parsedDiagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
    !parsed.ir
  ) {
    return parsedDiagnostics;
  }
  const compiled = compileIntentProgram({
    program: parsed.ir,
    sourceMap: parsed.sourceMap
  });
  return compiled.ok
    ? parsedDiagnostics
    : [...parsedDiagnostics, ...compiled.diagnostics.map(compilerDiagnostic)];
};

/**
 * Agent-facing aggregate diagnostics for the complete parse and the first
 * compiler stage that rejects the normalized source. Existing command errors
 * remain intentionally unchanged and continue to report one issue.
 */
export const diagnoseIntentProgramSource = (
  source: string
): IntentProgramDiagnosticReport => {
  const diagnostics = compileDiagnostics(parseIntentProgram(source));
  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    diagnostics
  };
};

const provenanceDiagnostics = (
  source: IntentProgramSource
):
  | { readonly ok: true; readonly source: IntentProgramSource }
  | {
      readonly ok: false;
      readonly diagnostics: readonly IntentProgramPreviewDiagnostic[];
    } => {
  const read = readIntentProgramSource(source);
  if (!read.ok) {
    return {
      ok: false,
      diagnostics: read.issues.map((issue) => sourceDiagnostic(
        'intent-program.preview.invalid-provenance',
        issue.message,
        issue.path
      ))
    };
  }
  return { ok: true, source: read.source };
};

const materializationSourcePath = (path: string): string => {
  if (path.startsWith('intentProgram.source')) return 'source';
  if (path.startsWith('intentProgram.')) {
    return path.slice('intentProgram.'.length);
  }
  if (path.startsWith('textures')) return 'appearance.palette';
  if (path.startsWith('modeling')) return 'model';
  return path;
};

/**
 * Purely rebuilds a staged pending program for rendering. The candidate is
 * returned only when its compiler-owned output exactly matches the receipt;
 * no command, revision, proposal, or persistence authority is changed.
 */
export const previewIntentProgram = (
  document: ProjectDocument,
  pending: IntentProgramSource
): PreviewIntentProgramResult => {
  const provenance = provenanceDiagnostics(pending);
  if (!provenance.ok) return provenance;
  const source = provenance.source;
  const parsed = parseIntentProgram(source.source);
  const diagnostics = compileDiagnostics(parsed);
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { ok: false, diagnostics };
  }
  if (!parsed.canonical || !parsed.hash || parsed.hash !== source.hash) {
    return {
      ok: false,
      diagnostics: [sourceDiagnostic(
        'intent-program.preview.hash-mismatch',
        'Intent Program hash does not match its normalized source.',
        'hash'
      )]
    };
  }
  const receiptDiagnostics = validateIntentProgramReceipt(source, {
    source: source.source,
    semanticCanonical: parsed.canonical
  });
  if (receiptDiagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: receiptDiagnostics.map((issue) => sourceDiagnostic(
        'intent-program.preview.receipt-mismatch',
        issue.message,
        issue.path
      ))
    };
  }
  const materialized = materializeIntentProgram(document, source);
  if (!materialized.ok) {
    const path = materializationSourcePath(materialized.error.path);
    return {
      ok: false,
      diagnostics: [sourceDiagnostic(
        'intent-program.preview.materialization-failed',
        materialized.error.message,
        path,
        resolveIntentProgramSourceSpan(parsed.sourceMap, path)
      )]
    };
  }
  const outputDigest = intentProgramOutputDigest(materialized.document);
  if (outputDigest !== source.receipt.outputDigest) {
    return {
      ok: false,
      diagnostics: [sourceDiagnostic(
        'intent-program.preview.output-digest-mismatch',
        'Compiler output no longer matches the reviewed preview. Propose the program again.',
        'receipt.outputDigest'
      )]
    };
  }
  return {
    ok: true,
    preview: {
      candidateDocument: materialized.document,
      sourceDigest: source.receipt.sourceDigest,
      outputDigest
    }
  };
};
