import { validateIntentProgramReceipt } from '../provenance/program';
import type { ProjectDocument } from '../model';
import { parseIntentProgram } from '../project/program';
import type {
  ProjectFileSerializationError,
  ProjectFileSerializationErrorCode,
  SerializeProjectFileResult
} from './contract';

const failure = (
  code: ProjectFileSerializationErrorCode,
  message: string,
  path: string
): SerializeProjectFileResult => {
  const error: ProjectFileSerializationError = Object.freeze({
    code,
    message,
    path
  });
  return Object.freeze({ ok: false, error });
};

/** Returns the exact confirmed source text and no runtime receipt or envelope. */
export const serializeProjectFile = (
  document: ProjectDocument
): SerializeProjectFileResult => {
  if (document.intentProgramProposal) {
    return failure(
      'project-file.pending_source',
      'A project with a pending Intent Program cannot be saved.',
      'intentProgramProposal'
    );
  }
  const authority = document.intentProgram;
  if (!authority) {
    return failure(
      'project-file.missing_source',
      'A project requires one compiled Intent Program before it can be saved.',
      'intentProgram'
    );
  }
  const parsed = parseIntentProgram(authority.source);
  const parseIssue = parsed.diagnostics.find((entry) =>
    entry.severity === 'error'
  );
  if (
    parseIssue || !parsed.canonical || !parsed.hash ||
    parsed.hash !== authority.hash
  ) {
    return failure(
      'project-file.invalid_source',
      parseIssue?.message ??
        'Confirmed Intent Program hash does not match its source.',
      parseIssue
        ? `intentProgram.source:${parseIssue.span.start.line}:${parseIssue.span.start.column}`
        : 'intentProgram.hash'
    );
  }
  const receiptIssue = validateIntentProgramReceipt(authority, {
    source: authority.source,
    semanticCanonical: parsed.canonical
  })[0];
  if (receiptIssue) {
    return failure(
      'project-file.invalid_source',
      receiptIssue.message,
      `intentProgram.${receiptIssue.path}`
    );
  }
  return Object.freeze({ ok: true, source: authority.source });
};
