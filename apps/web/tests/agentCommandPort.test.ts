import assert from 'node:assert/strict';

import type {
  CommandBatch,
  CommandReceipt
} from '@ashfox/engine-core';

import {
  AgentCommandPort,
  type AgentCommandPortStatus
} from '../src/features/agent/AgentCommandPort';
import {
  compactCommandReceipt
} from '../src/features/agent/compactReceipt';
import type {
  AgentRunRequest,
  DeliverResult,
  PresentRequest,
  PresentResult
} from '../src/features/agent/types';
import type {
  CommandOutcome
} from '../src/application/commandOutcome';
import {
  createOperationLease
} from '../src/application/operationLease';

const runRequest = (
  name = 'Port test'
): AgentRunRequest => ({
  operations: [{
    name: 'project.rename',
    payload: {
      name
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
  actorId: 'ashfox-agent',
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

type FakeInputListener = (this: FakeElement) => void;

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly attributeWrites: { name: string; value: string }[] = [];
  readonly children: FakeElement[] = [];
  readonly style: Record<string, string> = {};
  parent: FakeElement | null = null;
  type = '';
  tabIndex = 0;
  value = '';
  private readonly listeners = new Map<string, FakeInputListener[]>();

  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    this.attributeWrites.push({ name, value });
  }

  addEventListener(name: string, listener: FakeInputListener): void {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name: string, listener: FakeInputListener): void {
    this.listeners.set(
      name,
      (this.listeners.get(name) ?? []).filter(
        (candidate) => candidate !== listener
      )
    );
  }

  dispatch(name: string): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener.call(this);
    }
  }

  blur(): void {}

  remove(): void {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }
}

class FakeDocument {
  readonly head = new FakeElement();
  readonly body = new FakeElement();

  createElement(): FakeElement {
    return new FakeElement();
  }
}

export const test = (async (): Promise<void> => {
{
  let submits = 0;
  const submitted: CommandBatch[] = [];
  const statuses: AgentCommandPortStatus[] = [];
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: { commandPort: 'connected' }
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      submitted.push(value);
      return committed(value.batchId);
    },
    present: async (request) => ({
      ok: true,
      revision: 'local-0001',
      data: {
        frameNonce: 42,
        mode: 'frame',
        camera: 'front',
        cameraMatrix: [1, 0, 0, 0],
        clipId: null,
        playing: false,
        observedTimeSeconds: 0,
        completedCycles: 0,
        previewIssues: []
      }
    }),
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
  const unknownInspectProperty = port.inspect({
    kind: 'target',
    ignored: true
  } as unknown as { kind: 'target' });
  assert.equal(unknownInspectProperty.ok, false);
  if (!unknownInspectProperty.ok) {
    assert.equal(unknownInspectProperty.error.path, 'ignored');
  }
  assert.deepEqual(
    await port.present({
      review: 'next'
    }),
    {
      ok: true,
      revision: 'local-0001',
      data: {
        frameNonce: 42,
        mode: 'frame',
        camera: 'front',
        cameraMatrix: [1, 0, 0, 0],
        clipId: null,
        playing: false,
        observedTimeSeconds: 0,
        completedCycles: 0,
        previewIssues: []
      }
    }
  );
  const invalidPresent = await port.present({
    review: 'all'
  } as unknown as PresentRequest);
  assert.equal(invalidPresent.ok, false);
  if (!invalidPresent.ok) {
    assert.equal(invalidPresent.error.code, 'invalid_request');
  }
  const unknownPresentProperty = await port.present({
    review: 'next',
    ignored: true
  } as PresentRequest);
  assert.equal(unknownPresentProperty.ok, false);
  if (!unknownPresentProperty.ok) {
    assert.equal(unknownPresentProperty.error.path, 'ignored');
  }
  assert.deepEqual(await port.run(runRequest()), {
    ok: true,
    revision: 'local-0002',
    receipt: compactCommandReceipt(receipt('agent-run:1'))
  });
  assert.equal(submits, 1);
  assert.deepEqual(submitted[0], {
    batchId: 'agent-run:1',
    baseProjectId: 'project-test',
    baseRevision: 'local-0001',
    operations: runRequest().operations
  });
  assert.deepEqual(statuses, ['working', 'connected']);

  const secondResult = await port.run(runRequest('Second request'));
  assert.equal(secondResult.ok, true);
  assert.equal(submits, 2);
}

{
  let resolveDelivery:
    ((result: DeliverResult) => void) | undefined;
  const statuses: AgentCommandPortStatus[] = [];
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (value) => committed(value.batchId),
    deliver: () =>
      new Promise<DeliverResult>((resolve) => {
        resolveDelivery = resolve;
      }),
    onStatusChange: (status) => statuses.push(status)
  });
  const first = port.deliver();
  const duplicate = port.deliver();
  const competing = await port.run(runRequest());
  assert.equal(competing.ok, false);
  if (!competing.ok) {
    assert.equal(competing.error.code, 'invalid_state');
  }
  assert.ok(resolveDelivery);
  resolveDelivery({
    ok: true,
    revision: 'local-0001',
    artifact: {
      name: 'asset.glb',
      contentType: 'model/gltf-binary',
      byteLength: 128,
      target: 'glb',
      contentHash: 'sha256:test'
    }
  });
  assert.deepEqual(await duplicate, await first);
  assert.deepEqual(statuses, ['working', 'connected']);
}

{
  let submits = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async () => {
      submits += 1;
      return committed('unexpected');
    }
  });
  const invalid = await port.run({
    operations: []
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, 'invalid_batch');
  assert.equal(submits, 0);

  const unknownRequestProperty = await port.run({
    ...runRequest(),
    ignored: true
  } as unknown as AgentRunRequest);
  assert.equal(unknownRequestProperty.ok, false);
  if (!unknownRequestProperty.ok) {
    assert.equal(unknownRequestProperty.error.code, 'invalid_batch');
    assert.equal(unknownRequestProperty.error.path, 'ignored');
  }
  const unknownOperationProperty = await port.run({
    operations: [{
      name: 'project.rename',
      payload: { name: 'Must not submit' },
      ignored: true
    }]
  } as unknown as AgentRunRequest);
  assert.equal(unknownOperationProperty.ok, false);
  if (!unknownOperationProperty.ok) {
    assert.equal(unknownOperationProperty.error.code, 'invalid_batch');
    assert.equal(
      unknownOperationProperty.error.path,
      'operations[0].ignored'
    );
  }
  assert.equal(submits, 0);

  const rawGeometry = await port.run({
    operations: [{
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-raw',
          name: 'raw',
          parentId: null,
          bounds: {
            from: [0, 0, 0],
            to: [1, 1, 1]
          }
        }]
      }
    }]
  });
  assert.equal(rawGeometry.ok, false);
  if (!rawGeometry.ok) {
    assert.equal(rawGeometry.error.code, 'invalid_batch');
  }
  assert.equal(submits, 0);
}

{
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0004',
      data: null
    }),
    currentProjectId: () => 'project-test',
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
      },
      findings: [{
        code: 'scene.root_missing',
        severity: 'error',
        message: 'Candidate root is missing.',
        path: 'scene.roots[0]'
      }],
      findingsTruncated: true
    })
  });
  assert.deepEqual(await port.run(runRequest()), {
    ok: false,
    revision: 'local-0004',
    error: {
      code: 'revision_mismatch',
      message: 'Batch revision does not match the active project.',
      path: 'baseRevision',
      expected: 'local-0004'
    },
    findings: [{
      code: 'scene.root_missing',
      severity: 'error',
      message: 'Candidate root is missing.',
      path: 'scene.roots[0]'
    }],
    findingsTruncated: true
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
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: () => {
      submits += 1;
      return new Promise<CommandOutcome>((resolve) => {
        resolveSubmit = resolve;
      });
    },
    onStatusChange: (status) => statuses.push(status)
  });
  const value = runRequest();
  const first = port.run(value);
  const duplicate = port.run({
    operations: [{
      payload: { name: 'Port test' },
      name: 'project.rename'
    }]
  });
  const competing = await port.run(runRequest('Competing'));
  assert.equal(submits, 1);
  assert.equal(competing.ok, false);
  if (!competing.ok) assert.equal(competing.error.code, 'invalid_state');
  assert.ok(resolveSubmit);
  resolveSubmit(committed('agent-run:1'));
  assert.deepEqual(await duplicate, await first);
  assert.equal(
    submits,
    1,
    'property order must not change in-flight request identity'
  );
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
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0007',
    submit: async () => {
      throw failure;
    },
    onStatusChange: (status) => statuses.push(status)
  });
  const result = await port.run(runRequest());
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

{
  const fakeDocument = new FakeDocument();
  const fakeWindow = { document: fakeDocument };
  let resolvePresentation:
    ((result: PresentResult) => void) | undefined;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: { state: 'inspected' }
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (value) => committed(value.batchId),
    present: () =>
      new Promise<PresentResult>((resolve) => {
        resolvePresentation = resolve;
      })
  });
  const disconnect = port.connect(fakeWindow as unknown as Window);
  const inputAttribute = 'data-agent-command-port-input';
  const resultAttribute = 'data-agent-command-port-result';
  const currentInput = (): FakeElement => {
    const value = fakeDocument.body.children.find(
      (child) => child.attributes.has(inputAttribute)
    );
    assert.ok(value);
    return value;
  };
  const resultElement = fakeDocument.head.children.find(
    (child) => child.attributes.has(resultAttribute)
  );
  assert.ok(resultElement);

  const firstInput = currentInput();
  firstInput.value = JSON.stringify({
    requestId: 'present-first',
    method: 'present',
    payload: {
      review: 'next'
    }
  });
  firstInput.dispatch('input');
  await Promise.resolve();
  const secondInput = currentInput();
  assert.notEqual(
    secondInput,
    firstInput,
    'the bridge must rotate the input before awaiting an async command'
  );
  secondInput.value = JSON.stringify({
    requestId: 'inspect-second',
    method: 'inspect'
  });
  secondInput.dispatch('input');
  assert.ok(resolvePresentation);
  resolvePresentation({
    ok: true,
    revision: 'local-0001',
    data: {
      frameNonce: 1,
      mode: 'frame',
      camera: 'front',
      cameraMatrix: [1, 0, 0, 0],
      clipId: null,
      playing: false,
      observedTimeSeconds: 0,
      completedCycles: 0,
      previewIssues: []
    }
  });
  await new Promise<void>((resolve) => setImmediate(resolve));

  const responses = resultElement.attributeWrites
    .filter(
      (write) =>
        write.name === resultAttribute &&
        write.value.length > 0
    )
    .map((write) => JSON.parse(write.value).requestId);
  assert.deepEqual(
    responses,
    ['present-first', 'inspect-second'],
    'fallback transport responses must preserve request order'
  );
  assert.equal(fakeDocument.body.children.length, 1);
  disconnect();
  assert.equal(fakeDocument.body.children.length, 0);
  assert.equal(fakeDocument.head.children.length, 0);
}

{
  const fakeDocument = new FakeDocument();
  const fakeWindow = { document: fakeDocument };
  let submits = 0;
  let currentProjectId = 'project-old';
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => currentProjectId,
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      assert.equal(value.batchId, 'agent-request:repeat-run');
      assert.equal(value.baseProjectId, 'project-old');
      currentProjectId = 'project-new';
      return {
        ...committed(value.batchId),
        receipt: {
          ...receipt(value.batchId),
          projectId: currentProjectId
        }
      };
    }
  });
  const disconnect = port.connect(fakeWindow as unknown as Window);
  const currentInput = (): FakeElement => {
    const value = fakeDocument.body.children.find(
      (child) =>
        child.attributes.has('data-agent-command-port-input')
    );
    assert.ok(value);
    return value;
  };
  const projectRequest = (
    name: string
  ): AgentRunRequest => ({
    operations: [{
      name: 'project.create',
      payload: { name }
    }]
  });
  const dispatchRun = (name: string): void => {
    const input = currentInput();
    input.value = JSON.stringify({
      requestId: 'repeat-run',
      method: 'run',
      payload: projectRequest(name)
    });
    input.dispatch('input');
  };

  dispatchRun('Bridge project');
  await new Promise<void>((resolve) => setImmediate(resolve));
  dispatchRun('Bridge project');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    submits,
    1,
    'the DOM request ID must replay one derived canonical batch'
  );

  dispatchRun('Conflicting bridge project');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(submits, 1);
  const resultElement = fakeDocument.head.children.find(
    (child) =>
      child.attributes.has('data-agent-command-port-result')
  );
  assert.ok(resultElement);
  const lastResult = JSON.parse(
    resultElement.attributes.get(
      'data-agent-command-port-result'
    ) ?? '{}'
  ).result;
  assert.equal(lastResult.ok, false);
  assert.equal(lastResult.error.code, 'invalid_batch');
  assert.equal(lastResult.error.path, 'requestId');
  disconnect();
}

{
  const fakeDocument = new FakeDocument();
  const fakeWindow = { document: fakeDocument };
  let resolvePresentation:
    ((result: PresentResult) => void) | undefined;
  let submits = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      return committed(value.batchId);
    },
    present: () =>
      new Promise<PresentResult>((resolve) => {
        resolvePresentation = resolve;
      })
  });
  const disconnect = port.connect(fakeWindow as unknown as Window);
  const currentInput = (): FakeElement => {
    const value = fakeDocument.body.children.find(
      (child) =>
        child.attributes.has('data-agent-command-port-input')
    );
    assert.ok(value);
    return value;
  };

  const firstInput = currentInput();
  firstInput.value = JSON.stringify({
    requestId: 'slow-present',
    method: 'present',
    payload: {
      review: 'next'
    }
  });
  firstInput.dispatch('input');
  await Promise.resolve();

  const queuedInput = currentInput();
  queuedInput.value = JSON.stringify({
    requestId: 'queued-run',
    method: 'run',
    payload: runRequest()
  });
  queuedInput.dispatch('input');
  disconnect();
  assert.ok(resolvePresentation);
  resolvePresentation({
    ok: true,
    revision: 'local-0001',
    data: {
      frameNonce: 1,
      mode: 'frame',
      camera: 'front',
      cameraMatrix: [1, 0, 0, 0],
      clipId: null,
      playing: false,
      observedTimeSeconds: 0,
      completedCycles: 0,
      previewIssues: []
    }
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    submits,
    0,
    'disconnect must cancel queued mutations before submission'
  );
}

{
  const operationLease = createOperationLease();
  let submits = 0;
  let deliveries = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      return committed(value.batchId);
    },
    deliver: async () => {
      deliveries += 1;
      return {
        ok: false,
        revision: 'local-0001',
        error: { code: 'export_failed' }
      };
    },
    operationLease
  });

  for (const owner of [
    'file.open',
    'file.save',
    'file.export'
  ]) {
    const fileLease = operationLease.tryAcquire(owner);
    assert.ok(fileLease);
    const blockedRun = await port.run(
      runRequest(`Blocked by ${owner}`)
    );
    assert.equal(blockedRun.ok, false);
    if (!blockedRun.ok) {
      assert.match(blockedRun.error.message ?? '', new RegExp(owner));
    }
    const blockedDelivery = await port.deliver();
    assert.equal(blockedDelivery.ok, false);
    if (!blockedDelivery.ok) {
      assert.equal(blockedDelivery.error.code, 'busy');
    }
    fileLease.release();
  }
  assert.equal(submits, 0);
  assert.equal(deliveries, 0);
}

{
  const operationLease = createOperationLease();
  let resolveSubmit: ((outcome: CommandOutcome) => void) | undefined;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: (batch) =>
      new Promise<CommandOutcome>((resolve) => {
        resolveSubmit = (outcome) => resolve({
          ...outcome,
          commandId: batch.batchId
        });
      }),
    operationLease
  });

  const running = port.run(runRequest('Lease held by run'));
  assert.equal(operationLease.currentOwner(), 'agent.run');
  for (const owner of [
    'file.open',
    'file.save',
    'file.export'
  ]) {
    assert.equal(operationLease.tryAcquire(owner), null);
  }
  await Promise.resolve();
  assert.ok(resolveSubmit);
  resolveSubmit(committed('agent-run:1'));
  assert.equal((await running).ok, true);
  assert.equal(operationLease.currentOwner(), null);
}

{
  const operationLease = createOperationLease();
  let observedBorrowedLease = false;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId),
    deliver: async (lease) => {
      observedBorrowedLease = operationLease.isActive(lease);
      for (const owner of [
        'file.open',
        'file.save',
        'file.export'
      ]) {
        assert.equal(operationLease.tryAcquire(owner), null);
      }
      return {
        ok: true,
        revision: 'local-0001',
        artifact: {
          name: 'asset.glb',
          contentType: 'model/gltf-binary',
          byteLength: 128,
          target: 'glb',
          contentHash: 'sha256:test'
        }
      };
    },
    operationLease
  });

  assert.equal((await port.deliver()).ok, true);
  assert.equal(observedBorrowedLease, true);
  assert.equal(operationLease.currentOwner(), null);
}

{
  const operationLease = createOperationLease();
  const statuses: AgentCommandPortStatus[] = [];
  let submits = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: () => {
      submits += 1;
      throw new Error('synchronous submit failure');
    },
    operationLease,
    onStatusChange: (status) => statuses.push(status)
  });

  assert.equal((await port.run(runRequest('First sync failure'))).ok, false);
  assert.equal(operationLease.currentOwner(), null);
  assert.equal((await port.run(runRequest('Second sync failure'))).ok, false);
  assert.equal(submits, 2);
  assert.equal(operationLease.currentOwner(), null);
  assert.deepEqual(statuses, [
    'working',
    'connected',
    'working',
    'connected'
  ]);
}

{
  const operationLease = createOperationLease();
  const statuses: AgentCommandPortStatus[] = [];
  let deliveries = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId),
    deliver: () => {
      deliveries += 1;
      throw new Error('synchronous delivery failure');
    },
    operationLease,
    onStatusChange: (status) => statuses.push(status)
  });

  assert.equal((await port.deliver()).ok, false);
  assert.equal(operationLease.currentOwner(), null);
  assert.equal((await port.deliver()).ok, false);
  assert.equal(deliveries, 2);
  assert.equal(operationLease.currentOwner(), null);
  assert.deepEqual(statuses, [
    'working',
    'connected',
    'working',
    'connected'
  ]);
}
})();
