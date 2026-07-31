import type {
  CommandError,
  CommandReceipt,
  InvariantFinding
} from '@ashfox/engine-core';

export const COMMAND_OUTCOME_FINDING_LIMIT = 10;

export const boundedCommandFindings = (
  findings: readonly InvariantFinding[] | undefined
): {
  findings?: readonly InvariantFinding[];
  findingsTruncated?: boolean;
} => {
  if (!findings || findings.length === 0) return {};
  return {
    findings: findings.slice(0, COMMAND_OUTCOME_FINDING_LIMIT),
    findingsTruncated:
      findings.length > COMMAND_OUTCOME_FINDING_LIMIT
  };
};

export type CommandOutcome =
  | {
      status: 'committed';
      commandId: string;
      receipt: CommandReceipt;
    }
  | {
      status: 'rejected';
      commandId: string;
      revision: string;
      error: CommandError;
      findings?: readonly InvariantFinding[];
      findingsTruncated?: boolean;
    };
