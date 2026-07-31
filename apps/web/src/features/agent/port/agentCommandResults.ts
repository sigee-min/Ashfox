import type {
  CommandOutcome
} from '../../../application/commandOutcome';
import {
  compactCommandReceipt
} from '../compactReceipt';
import type {
  RunResult
} from '../types';

export const invalidBatchResult = (
  revision: string,
  path: string,
  expected: string
): RunResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_batch',
    message: 'Command batch is invalid.',
    path,
    expected
  }
});

export const terminalRunFailure = (
  revision: string,
  message: string
): RunResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_state',
    message
  }
});

export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === 'AbortError';

export const runResultFromOutcome = (
  outcome: CommandOutcome
): RunResult => {
  if (outcome.status === 'rejected') {
    return {
      ok: false,
      revision: outcome.revision,
      error: outcome.error,
      ...(outcome.findings
        ? { findings: outcome.findings }
        : {}),
      ...(outcome.findingsTruncated !== undefined
        ? { findingsTruncated: outcome.findingsTruncated }
        : {})
    };
  }
  return {
    ok: true,
    revision: outcome.receipt.revision,
    receipt: compactCommandReceipt(outcome.receipt)
  };
};
