import { defineCommand } from '../definition';
import { materializeIntentProgram } from '../../compiler/program';
import {
  createIntentProgramSourceV1,
  intentProgramReviewDigest
} from '../../provenance/program';
import { INTENT_PROGRAM_SOURCE_MAX_LENGTH } from '../../project/program/language';
import { intentProgramError, parseIntentProgramSource } from './source';

export const intentProgramProposalInputSchema = {
  type: 'object',
  properties: {
    source: {
      type: 'string',
      minLength: 1,
      maxLength: INTENT_PROGRAM_SOURCE_MAX_LENGTH,
      description: 'Closed, coordinate-free Intent Program source.'
    }
  },
  required: ['source'],
  additionalProperties: false
} as const;

/** Agent-facing staging boundary. Parsed results are deliberately not stored. */
export const proposeIntentProgramCommand = defineCommand({
  name: 'intent.program.propose',
  label: 'Propose Intent Program',
  purpose: 'Validate and stage one source-authoritative Intent Program for autonomous compilation.',
  inputSchema: intentProgramProposalInputSchema,
  apply: (document, payload) => {
    const parsed = parseIntentProgramSource(payload.source);
    const issue = intentProgramError(parsed);
    if (issue || !parsed.hash || !parsed.canonical) {
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
    const candidateSource = { source: payload.source, hash: parsed.hash };
    const materialized = materializeIntentProgram(document, candidateSource);
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
    const proposal = createIntentProgramSourceV1(
      candidateSource,
      parsed.canonical,
      materialized.document
    );
    const sameAsConfirmed = document.intentProgram !== undefined &&
      intentProgramReviewDigest(document.intentProgram) ===
        proposal.receipt.sourceDigest;
    const changed = !sameAsConfirmed &&
      (document.intentProgramProposal === undefined ||
        intentProgramReviewDigest(document.intentProgramProposal) !==
          proposal.receipt.sourceDigest);
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
          ? 'Intent Program already matches compiled source'
          : 'Staged Intent Program; awaiting Agent compilation decision',
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
