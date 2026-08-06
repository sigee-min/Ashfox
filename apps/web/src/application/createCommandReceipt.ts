import type {
  CommandEffects,
  CommandReceipt,
  CommandSource,
  InvariantFinding
} from '@ashfox/engine-core';
import { COMMAND_RECEIPT_SCHEMA_VERSION } from '@ashfox/engine-core';

export interface CreateCommandReceiptInput {
  commandId: string;
  projectId: string;
  source: CommandSource;
  actorId: string;
  summary: string;
  beforeRevision: string;
  revision: string;
  completedAt: string;
  effects: CommandEffects;
  findings?: readonly InvariantFinding[];
  durationMs?: number;
}

export const createCommandReceipt = (
  input: CreateCommandReceiptInput
): CommandReceipt => ({
  schemaVersion: COMMAND_RECEIPT_SCHEMA_VERSION,
  commandId: input.commandId,
  projectId: input.projectId,
  actorId: input.actorId,
  source: input.source,
  summary: input.summary,
  beforeRevision: input.beforeRevision,
  revision: input.revision,
  completedAt: input.completedAt,
  durationMs: input.durationMs ?? 0,
  effects: input.effects,
  findings: input.findings ?? []
});
