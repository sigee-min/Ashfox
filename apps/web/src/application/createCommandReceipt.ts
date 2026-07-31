import type {
  CommandEffects,
  CommandReceipt,
  CommandSource,
  InvariantFinding
} from '@ashfox/engine-core';

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
  schemaVersion: 1,
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
