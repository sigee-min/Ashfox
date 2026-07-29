import assert from 'node:assert/strict';

import type {
  CommandBatch,
  CommandReceipt
} from '@ashfox/engine-core';

import {
  AgentCommandPort,
  type AgentCommandPortStatus
} from '../src/features/agent/AgentCommandPort';
import type {
  CommandOutcome
} from '../src/features/workbench/state/commandOutcome';

const batch = (
  batchId: string,
  baseRevision = 'local-0001'
): CommandBatch => ({
  batchId,
  baseRevision,
  operations: [{
    name: 'project.rename',
    payload: {
      name: 'Port test'
    }
  }]
});

const receipt = (
  commandId: string,
  revision = 'local-0002'
): CommandReceipt => ({
  schemaVersion: 1,
  commandId,
  projectId: 'project-test',
  actorId: 'ai-ide',
  source: 'agent',
  summary: 'Rename project',
  beforeRevision: 'local-0001',
  revision,
  completedAt: '2026-01-01T00:00:00.000Z',
  durationMs: 0,
  effects: {
    createdEntityIds: [],
    changedEntityIds: ['project-test'],
    removedEntityIds: [],
    invalidated: ['validation', 'preview']
  },
  findings: []
});

const committed = (commandId: string): CommandOutcome => ({
  status: 'committed',
  commandId,
  receipt: receipt(commandId)
});

export const test = (async (): Promise<void> => {
{
  let submits = 0;
  const statuses: AgentCommandPortStatus[] = [];
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: { commandPort: 'connected' }
    }),
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      return committed(value.batchId);
    },
    onStatusChange: (status) => statuses.push(status)
  });

  assert.deepEqual(port.inspect(), {
    ok: true,
    revision: 'local-0001',
    data: { commandPort: 'connected' }
  });
  const invalidInspect = port.inspect(
    { kind: 'entity', ids: null } as unknown as {
      kind: 'entity';
      ids: readonly string[];
    }
  );
  assert.equal(invalidInspect.ok, false);
  if (!invalidInspect.ok) {
    assert.equal(invalidInspect.error.code, 'invalid_request');
  }
  assert.deepEqual(await port.run(batch('commit')), {
    ok: true,
    revision: 'local-0002',
    receipt: receipt('commit')
  });
  assert.equal(submits, 1);
  assert.deepEqual(statuses, ['working', 'connected']);

  const duplicateResult = await port.run(batch('commit'));
  assert.equal(duplicateResult.ok, true);
  assert.equal(submits, 1);

  const conflictingDuplicate = await port.run({
    ...batch('commit'),
    operations: [{
      name: 'project.rename',
      payload: {
        name: 'Different content'
      }
    }]
  });
  assert.equal(conflictingDuplicate.ok, false);
  if (!conflictingDuplicate.ok) {
    assert.equal(conflictingDuplicate.error.code, 'invalid_batch');
  }
  assert.equal(submits, 1);
}

{
  let submits = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentRevision: () => 'local-0001',
    submit: async () => {
      submits += 1;
      return committed('unexpected');
    }
  });
  const invalid = await port.run({
    batchId: 'invalid',
    baseRevision: 'local-0001',
    operations: []
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, 'invalid_batch');
  assert.equal(submits, 0);
}

{
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0004',
      data: null
    }),
    currentRevision: () => 'local-0004',
    submit: async (value) => ({
      status: 'rejected',
      commandId: value.batchId,
      revision: 'local-0004',
      error: {
        code: 'revision_mismatch',
        message: 'Batch revision does not match the active project.',
        path: 'baseRevision',
        expected: 'local-0004'
      }
    })
  });
  assert.deepEqual(await port.run(batch('stale')), {
    ok: false,
    revision: 'local-0004',
    error: {
      code: 'revision_mismatch',
      message: 'Batch revision does not match the active project.',
      path: 'baseRevision',
      expected: 'local-0004'
    }
  });
}

{
  let resolveSubmit: ((outcome: CommandOutcome) => void) | undefined;
  let submits = 0;
  const statuses: AgentCommandPortStatus[] = [];
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentRevision: () => 'local-0001',
    submit: (value) => {
      submits += 1;
      return new Promise<CommandOutcome>((resolve) => {
        resolveSubmit = resolve;
      });
    },
    onStatusChange: (status) => statuses.push(status)
  });
  const value = batch('in-flight');
  const first = port.run(value);
  const duplicate = port.run(value);
  const competing = await port.run(batch('competing'));
  assert.equal(submits, 1);
  assert.equal(competing.ok, false);
  if (!competing.ok) assert.equal(competing.error.code, 'invalid_state');
  assert.ok(resolveSubmit);
  resolveSubmit(committed(value.batchId));
  assert.deepEqual(await duplicate, await first);
  assert.deepEqual(statuses, ['working', 'connected']);
}

for (const failure of [
  Object.assign(new Error('cancelled'), { name: 'AbortError' }),
  new Error('unexpected')
]) {
  const statuses: AgentCommandPortStatus[] = [];
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0007',
      data: null
    }),
    currentRevision: () => 'local-0007',
    submit: async () => {
      throw failure;
    },
    onStatusChange: (status) => statuses.push(status)
  });
  const result = await port.run(
    batch(failure.name === 'AbortError' ? 'cancelled' : 'exception')
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'invalid_state');
    assert.match(
      result.error.message ?? '',
      failure.name === 'AbortError' ? /cancelled/ : /could not be submitted/
    );
  }
  assert.deepEqual(statuses, ['working', 'connected']);
}
})();
