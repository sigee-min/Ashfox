import type {
  CommandReceipt
} from '@ashfox/engine-core';

import type {
  AgentCommandReceipt,
  AgentReceiptEntityIds
} from './types';

const ENTITY_ID_LIMIT = 16;
const FINDING_LIMIT = 10;

const boundedIds = (
  ids: readonly string[]
): AgentReceiptEntityIds => ({
  ids: ids.slice(0, ENTITY_ID_LIMIT),
  count: ids.length,
  truncated: ids.length > ENTITY_ID_LIMIT
});

export const compactCommandReceipt = (
  receipt: CommandReceipt
): AgentCommandReceipt => ({
  schemaVersion: receipt.schemaVersion,
  commandId: receipt.commandId,
  projectId: receipt.projectId,
  actorId: receipt.actorId,
  source: receipt.source,
  summary: receipt.summary.slice(0, 500),
  beforeRevision: receipt.beforeRevision,
  revision: receipt.revision,
  completedAt: receipt.completedAt,
  durationMs: receipt.durationMs,
  effects: {
    created: boundedIds(receipt.effects.createdEntityIds),
    changed: boundedIds(receipt.effects.changedEntityIds),
    removed: boundedIds(receipt.effects.removedEntityIds),
    invalidated: receipt.effects.invalidated
  },
  findings: receipt.findings.slice(0, FINDING_LIMIT),
  findingsTruncated: receipt.findings.length > FINDING_LIMIT
});
