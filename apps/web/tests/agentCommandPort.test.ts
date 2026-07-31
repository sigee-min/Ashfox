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
  PresentRequest
} from '../src/features/agent/types';
import type {
  CommandOutcome
} from '../src/application/commandOutcome';

const batch = (
  batchId: string,
  baseRevision = 'local-0001'
): CommandBatch => ({
  batchId,
  baseProjectId: 'project-test',
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
      return committed(value.batchId);
    },
    present: async (request) => ({
      ok: true,
      revision: 'local-0001',
      data: {
        frameNonce: 42,
        mode: request.mode,
        camera: request.camera,
        cameraMatrix: [1, 0, 0, 0],
        clipId: request.clipId,
        playing: false,
        observedTimeSeconds: request.timeSeconds,
        completedCycles: request.mode === 'cycle' ? 1 : 0,
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
      kind: 'view',
      mode: 'frame',
      camera: 'front',
      clipId: 'clip-idle',
      timeSeconds: 0.25
    }),
    {
      ok: true,
      revision: 'local-0001',
      data: {
        frameNonce: 42,
        mode: 'frame',
        camera: 'front',
        cameraMatrix: [1, 0, 0, 0],
        clipId: 'clip-idle',
        playing: false,
        observedTimeSeconds: 0.25,
        completedCycles: 0,
        previewIssues: []
      }
    }
  );
  const invalidPresent = await port.present({
    kind: 'view',
    mode: 'frame',
    camera: 'front',
    clipId: '',
    timeSeconds: 0
  });
  assert.equal(invalidPresent.ok, false);
  if (!invalidPresent.ok) {
    assert.equal(invalidPresent.error.code, 'invalid_request');
  }
  const unknownPresentProperty = await port.present({
    kind: 'view',
    mode: 'frame',
    camera: 'front',
    clipId: null,
    timeSeconds: 0,
    ignored: true
  } as PresentRequest);
  assert.equal(unknownPresentProperty.ok, false);
  if (!unknownPresentProperty.ok) {
    assert.equal(unknownPresentProperty.error.path, 'ignored');
  }
  const invalidCycle = await port.present({
    kind: 'view',
    mode: 'cycle',
    camera: 'perspective',
    clipId: null,
    timeSeconds: 0
  });
  assert.equal(invalidCycle.ok, false);
  if (!invalidCycle.ok) {
    assert.equal(invalidCycle.error.code, 'invalid_request');
    assert.equal(invalidCycle.error.path, 'clipId');
  }
  assert.deepEqual(await port.run(batch('commit')), {
    ok: true,
    revision: 'local-0002',
    receipt: compactCommandReceipt(receipt('commit'))
  });
  assert.equal(submits, 1);
  assert.deepEqual(statuses, ['working', 'connected']);

  const duplicateResult = await port.run(batch('commit'));
  assert.equal(duplicateResult.ok, true);
  assert.equal(submits, 1);
  const reorderedDuplicate = await port.run({
    operations: [{
      payload: { name: 'Port test' },
      name: 'project.rename'
    }],
    baseRevision: 'local-0001',
    batchId: 'commit',
    baseProjectId: 'project-test'
  });
  assert.equal(reorderedDuplicate.ok, true);
  assert.equal(
    submits,
    1,
    'object property order must not change batch identity'
  );

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
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      return committed(value.batchId);
    }
  });
  for (let index = 0; index < 40; index += 1) {
    const result = await port.run(batch(`ledger-${index}`));
    assert.equal(result.ok, true);
  }
  assert.equal(submits, 40);
  const replay = await port.run(batch('ledger-0'));
  assert.equal(replay.ok, true);
  assert.equal(
    submits,
    40,
    'completed batch IDs remain idempotent for the browser session'
  );
  const conflict = await port.run({
    ...batch('ledger-0'),
    operations: [{
      name: 'project.rename',
      payload: { name: 'Conflicting replay' }
    }]
  });
  assert.equal(conflict.ok, false);
  assert.equal(submits, 40);
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
    batchId: 'invalid',
    baseProjectId: 'project-test',
    baseRevision: 'local-0001',
    operations: []
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, 'invalid_batch');
  assert.equal(submits, 0);

  const missingProject = await port.run({
    batchId: 'missing-project',
    baseRevision: 'local-0001',
    operations: [{
      name: 'project.rename',
      payload: { name: 'Must not submit' }
    }]
  } as unknown as CommandBatch);
  assert.equal(missingProject.ok, false);
  if (!missingProject.ok) {
    assert.equal(missingProject.error.code, 'invalid_batch');
  }
  assert.equal(submits, 0);

  const unknownBatchProperty = await port.run({
    ...batch('unknown-batch-property'),
    ignored: true
  } as CommandBatch);
  assert.equal(unknownBatchProperty.ok, false);
  if (!unknownBatchProperty.ok) {
    assert.equal(unknownBatchProperty.error.code, 'invalid_batch');
    assert.equal(unknownBatchProperty.error.path, 'ignored');
  }
  const unknownOperationProperty = await port.run({
    ...batch('unknown-operation-property'),
    operations: [{
      name: 'project.rename',
      payload: { name: 'Must not submit' },
      ignored: true
    }]
  } as CommandBatch);
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
    batchId: 'raw-geometry',
    baseProjectId: 'project-test',
    baseRevision: 'local-0001',
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
  assert.deepEqual(await port.run(batch('stale')), {
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
  let currentProjectId = 'project-a';
  let submits = 0;
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
      return committed(value.batchId);
    }
  });
  const forProject = (projectId: string): CommandBatch => ({
    ...batch('same-batch-id'),
    baseProjectId: projectId
  });
  const projectAResult = await port.run(forProject('project-a'));
  assert.equal(projectAResult.ok, true);
  currentProjectId = 'project-b';
  const projectBResult = await port.run(forProject('project-b'));
  assert.equal(projectBResult.ok, true);
  assert.equal(
    submits,
    2,
    'idempotency keys are independent across projects'
  );
  const cachedProjectA = await port.run(forProject('project-a'));
  assert.equal(cachedProjectA.ok, false);
  if (!cachedProjectA.ok) {
    assert.equal(cachedProjectA.error.code, 'project_mismatch');
  }
  assert.equal(submits, 2);
  const staleOldProject = await port.run({
    ...forProject('project-a'),
    batchId: 'unused-old-project-batch'
  });
  assert.equal(staleOldProject.ok, false);
  if (!staleOldProject.ok) {
    assert.equal(staleOldProject.error.code, 'project_mismatch');
    assert.equal(staleOldProject.error.expected, 'project-b');
  }
  assert.equal(submits, 2);
}

{
  let currentProjectId = 'project-old';
  let submits = 0;
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
      currentProjectId = 'project-new';
      return {
        status: 'committed',
        commandId: value.batchId,
        receipt: {
          ...receipt(value.batchId),
          projectId: 'project-new'
        }
      };
    }
  });
  const createBatch: CommandBatch = {
    batchId: 'create-project-replay',
    baseProjectId: 'project-old',
    baseRevision: 'local-0001',
    operations: [{
      name: 'project.create',
      payload: {
        id: 'project-new',
        name: 'New project',
        target: 'glb',
        namespace: 'ashfox',
        modelPath: 'new_project',
        createdAt: '2026-07-31T00:00:00.000Z'
      }
    }]
  };
  assert.equal((await port.run(createBatch)).ok, true);
  assert.equal((await port.run(createBatch)).ok, true);
  assert.equal(
    submits,
    1,
    'a project.create retry may replay its result after replacement'
  );
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
    currentProjectId: () => 'project-test',
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
  const disconnect = port.connect(fakeWindow as Window);
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
      kind: 'view',
      mode: 'frame',
      camera: 'front',
      clipId: null,
      timeSeconds: 0
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
  const disconnect = port.connect(fakeWindow as Window);
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
      kind: 'view',
      mode: 'frame',
      camera: 'front',
      clipId: null,
      timeSeconds: 0
    }
  });
  firstInput.dispatch('input');
  await Promise.resolve();

  const queuedInput = currentInput();
  queuedInput.value = JSON.stringify({
    requestId: 'queued-run',
    method: 'run',
    payload: batch('must-not-submit')
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
})();
