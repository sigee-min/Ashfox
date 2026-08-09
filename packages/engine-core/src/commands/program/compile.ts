import { validateProjectDocumentCandidate } from '../../validation/project/validate';
import {
  attestIntentProgramCandidate,
  DEFAULT_INTENT_VALIDATION_COMPUTATION
} from '../../validation/project/candidate';
import {
  INTENT_PROGRAM_DIGEST_LENGTH,
  INTENT_PROGRAM_DIGEST_PATTERN_SOURCE,
  intentProgramReviewDigest,
  validateIntentProgramReceipt
} from '../../provenance/program';
import { defineCommand } from '../definition';
import { parseIntentProgramSource } from './source';

export const intentProgramCompileInputSchema = {
  type: 'object',
  properties: {
    sourceDigest: {
      type: 'string',
      minLength: INTENT_PROGRAM_DIGEST_LENGTH,
      maxLength: INTENT_PROGRAM_DIGEST_LENGTH,
      pattern: INTENT_PROGRAM_DIGEST_PATTERN_SOURCE,
      description: 'SHA-256 digest of the Agent-verified staged Intent Program v1 source.'
    }
  },
  required: ['sourceDigest'],
  additionalProperties: false
} as const;

const compilerError = (
  message: string,
  path = 'payload.sourceDigest'
) => ({
  ok: false as const,
  error: {
    code: 'invalid_state' as const,
    message,
    path
  }
});

/**
 * The sole materialization boundary for an Intent Program. The compiler owns
 * the complete derived scene, authoring profile, recipe, and canonical idle;
 * it never merges a new program into hand-authored geometry.
 */
export const compileIntentProgramCommand = defineCommand({
  name: 'intent.program.compile',
  label: 'Compile Intent Program',
  purpose: 'Atomically replace the generated asset with the Agent-approved staged Intent Program output.',
  inputSchema: intentProgramCompileInputSchema,
  apply: (document, payload, context) => {
    const computation = context?.computation ??
      DEFAULT_INTENT_VALIDATION_COMPUTATION;
    const pending = document.intentProgramProposal;
    const source = pending ?? document.intentProgram;
    const authorityPath = pending
      ? 'intentProgramProposal'
      : 'intentProgram';
    if (!source) {
      return compilerError('There is no Intent Program source to compile.');
    }
    const reviewedDigest = intentProgramReviewDigest(source);
    if (reviewedDigest !== payload.sourceDigest) {
      return compilerError(
        'The staged Intent Program changed. Compile its current source digest.',
        'payload.sourceDigest'
      );
    }
    const parsed = parseIntentProgramSource(source.source);
    const parseIssue = parsed.diagnostics.find(
      (diagnostic) => diagnostic.severity === 'error'
    );
    if (
      !parsed.ir || !parsed.canonical ||
      parseIssue || parsed.hash !== source.hash
    ) {
      return compilerError(
        parseIssue?.message ?? 'Intent Program source is no longer valid.',
        parseIssue
          ? `program:${parseIssue.span.start.line}:${parseIssue.span.start.column}`
          : 'payload.sourceDigest'
      );
    }
    const receiptIssue = validateIntentProgramReceipt(source, {
      source: source.source,
      semanticCanonical: parsed.canonical
    })[0];
    if (receiptIssue) {
      return compilerError(
        receiptIssue.message,
        `${authorityPath}.${receiptIssue.path}`
      );
    }
    const materialized = computation.materialize(document, source);
    if (!materialized.ok) {
      return compilerError(materialized.error.message, materialized.error.path);
    }
    const verifiedOutputDigest = computation.outputDigest(materialized.document);
    const outputIssue = validateIntentProgramReceipt(source, {
      source: source.source,
      semanticCanonical: parsed.canonical,
      outputDigest: verifiedOutputDigest
    }).find((issue) => issue.path === 'receipt.outputDigest');
    if (outputIssue) {
      return compilerError(
        'Compiler output no longer matches the staged preview. Propose the program again before compiling.',
        `${authorityPath}.${outputIssue.path}`
      );
    }
    const confirmedSource = source;
    const result = {
      ...materialized.document,
      intentProgram: confirmedSource
    };
    const attestation = attestIntentProgramCandidate(
      materialized.document,
      result,
      confirmedSource.receipt.sourceDigest,
      verifiedOutputDigest
    );
    if (!attestation) {
      return compilerError(
        'Compiler output could not bind its ephemeral validation evidence.',
        'intentProgram'
      );
    }
    const validation = validateProjectDocumentCandidate(
      result,
      attestation,
      computation
    );
    const invalid = validation.findings.find(
      (finding) => finding.severity === 'error'
    );
    if (invalid) {
      return compilerError(
        `Compiler output violates ${invalid.path}: ${invalid.message}`,
        invalid.path
      );
    }
    if (context) context.validationAttestation = attestation;
    return {
      ok: true,
      value: {
        document: result,
        summary: 'Compile Intent Program',
        effects: {
          createdEntityIds: [
            'idle'
          ],
          changedEntityIds: [document.id],
          removedEntityIds: [],
          invalidated: [
            'scene',
            'textures',
            'uv',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
