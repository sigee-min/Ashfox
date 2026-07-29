import type {
  CommandError,
  CommandReceipt
} from '@ashfox/engine-core';

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
    };
