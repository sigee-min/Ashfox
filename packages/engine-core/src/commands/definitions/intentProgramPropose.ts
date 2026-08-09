import { defineCommand } from '../definition';
import { materializeIntentProgram } from '../../compiler/intentProgram';
import { intentProgramError, parseIntentProgramSource } from './intentProgramShared';

export const intentProgramProposalInputSchema = {
  type: 'object',
  properties: {
    source: {
      type: 'string',
      minLength: 1,
      maxLength: 20000,
      description: 'Closed, coordinate-free Intent Program source.'
    }
  },
  required: ['source'],
  additionalProperties: false
} as const;

/** Agent-facing source proposal. Parsed results are deliberately not stored. */
export const proposeIntentProgramCommand = defineCommand({
  name: 'intent.program.propose',
  label: 'Propose Intent Program',
  purpose: 'Validate and stage one source-authoritative Intent Program for review.',
  inputSchema: intentProgramProposalInputSchema,
  apply: (document, payload) => {
    const parsed = parseIntentProgramSource(payload.source);
    const issue = intentProgramError(parsed);
    if (issue || !parsed.hash) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: issue?.message ?? 'Intent Program could not be parsed.',
          path: issue?.path ?? 'payload.source',
          expected: issue?.expected
        }
      };
    }
    const proposal = { source: payload.source, hash: parsed.hash };
    const materialized = materializeIntentProgram(document, proposal);
    if (!materialized.ok) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: materialized.error.message,
          path: `payload.source:${materialized.error.path}`,
          expected: 'one complete semantic program that the compiler can materialize atomically'
        }
      };
    }
    const sameAsConfirmed = document.intentProgram?.hash === proposal.hash;
    const changed = !sameAsConfirmed &&
      document.intentProgramProposal?.hash !== proposal.hash;
    const { intentProgramProposal: _proposal, ...withoutProposal } = document;
    const next = sameAsConfirmed
      ? withoutProposal
      : changed
        ? { ...document, intentProgramProposal: proposal }
        : document;
    return {
      ok: true,
      value: {
        document: next,
        summary: sameAsConfirmed
          ? 'Intent Program already matches confirmed source'
          : 'Proposed Intent Program; awaiting confirmation',
        effects: {
          createdEntityIds: [],
          changedEntityIds: next === document ? [] : [document.id],
          removedEntityIds: [],
          invalidated: next === document ? [] : ['validation', 'preview'] as const
        }
      }
    };
  }
});
