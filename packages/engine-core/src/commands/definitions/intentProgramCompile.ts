import { materializeIntentProgram } from '../../compiler/intentProgram';
import { validateProjectDocument } from '../../validation/projectDocumentValidator';
import { defineCommand } from '../definition';
import { parseIntentProgramSource } from './intentProgramShared';

export const intentProgramCompileInputSchema = {
  type: 'object',
  properties: {
    hash: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
      description: 'Hash of the reviewed Intent Program source to compile.'
    }
  },
  required: ['hash'],
  additionalProperties: false
} as const;

const compilerError = (
  message: string,
  path = 'payload.hash'
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
  purpose: 'Atomically replace the generated asset with the reviewed Intent Program output.',
  inputSchema: intentProgramCompileInputSchema,
  apply: (document, payload) => {
    const source = document.intentProgramProposal ?? document.intentProgram;
    if (!source) {
      return compilerError('There is no Intent Program source to compile.');
    }
    if (source.hash !== payload.hash) {
      return compilerError(
        'The reviewed Intent Program changed. Compile the currently displayed hash.',
        'payload.hash'
      );
    }
    const parsed = parseIntentProgramSource(source.source);
    const parseIssue = parsed.diagnostics.find(
      (diagnostic) => diagnostic.severity === 'error'
    );
    if (!parsed.ir || parseIssue || parsed.hash !== source.hash) {
      return compilerError(
        parseIssue?.message ?? 'Intent Program source is no longer valid.',
        parseIssue
          ? `program:${parseIssue.span.start.line}:${parseIssue.span.start.column}`
          : 'payload.hash'
      );
    }
    const materialized = materializeIntentProgram(document, source);
    if (!materialized.ok) {
      return compilerError(materialized.error.message, materialized.error.path);
    }
    const result = materialized.document;
    const validation = validateProjectDocument(result);
    const invalid = validation.findings.find(
      (finding) => finding.severity === 'error'
    );
    if (invalid) {
      return compilerError(
        `Compiler output violates ${invalid.path}: ${invalid.message}`,
        invalid.path
      );
    }
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
