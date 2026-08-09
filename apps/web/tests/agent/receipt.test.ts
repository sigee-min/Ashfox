import assert from 'node:assert/strict';

import type {
  CommandReceipt
} from '@ashfox/engine-core';

import {
  compactCommandReceipt
} from '../../src/features/agent/compactReceipt';

const ids = Array.from({ length: 20 }, (_, index) => `entity-${index}`);
const receipt: CommandReceipt = {
  schemaVersion: 1,
  commandId: 'batch-large',
  projectId: 'project-large',
  actorId: 'ashfox-agent',
  source: 'agent',
  summary: 'Large receipt',
  beforeRevision: 'local-0001',
  revision: 'local-0002',
  completedAt: '2026-07-31T00:00:00.000Z',
  durationMs: 1,
  effects: {
    createdEntityIds: ids,
    changedEntityIds: [],
    removedEntityIds: [],
    invalidated: ['scene']
  },
  findings: []
};
const compact = compactCommandReceipt(receipt);
assert.equal(compact.effects.created.count, 20);
assert.equal(compact.effects.created.ids.length, 16);
assert.equal(compact.effects.created.truncated, true);
