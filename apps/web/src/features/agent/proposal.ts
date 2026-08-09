import type { ProjectDocument } from '@ashfox/engine-core';

export interface PendingIntentProgramBlock {
  path: 'intentProgramProposal';
  expected: string;
}

/** A staged source has no output authority until the Agent compiles it. */
export const pendingIntentProgramBlock = (
  document: ProjectDocument
): PendingIntentProgramBlock | null =>
  document.intentProgramProposal
    ? {
        path: 'intentProgramProposal',
        expected:
          'successful Agent-decided Intent Program compilation before producing canonical output'
      }
    : null;
