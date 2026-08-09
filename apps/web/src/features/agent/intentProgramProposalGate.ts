import type {
  ProjectDocument
} from '@ashfox/engine-core';

export interface PendingIntentProgramBlock {
  path: 'intentProgramProposal';
  expected: string;
}

/** A proposed source has no output authority until the user confirms it. */
export const pendingIntentProgramBlock = (
  document: ProjectDocument
): PendingIntentProgramBlock | null =>
  document.intentProgramProposal
    ? {
        path: 'intentProgramProposal',
        expected:
          'explicit user confirmation and successful Intent Program compilation before producing output'
      }
    : null;
