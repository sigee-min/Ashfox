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
  AgentCaptureRequest,
  AgentRunRequest,
  CaptureResult,
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
  requestId:
    `request-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
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

const captured = (
  kind: AgentCaptureRequest['kind'] = 'result'
): CaptureResult => ({
  ok: true,
  revision: 'local-0001',
  artifact: {
    kind,
    name: kind === 'result' ? 'asset.png' : `asset-${kind}.gif`,
    contentType: kind === 'result' ? 'image/png' : 'image/gif',
    byteLength: 256,
    contentHash: 'sha256:capture-test',
    width: 1280,
    height: 720,
    ...(kind === 'result'
      ? {}
      : { frameCount: 20, fps: 10 })
  }
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
        review: request.review,
        purpose:
          request.review === 'preview'
            ? 'preview'
            : 'delivery',
        milestone:
          request.review === 'preview'
            ? request.milestone ?? null
            : null,
        verdict:
          request.review === 'accept'
            ? 'accepted'
            : request.review === 'reject'
              ? 'rejected'
              : 'pending',
        issues:
          request.review === 'reject' ? request.issues : [],
        acknowledgedCheckIds:
          request.review === 'accept' ? request.checkIds : [],
        failedCheckIds:
          request.review === 'reject'
            ? request.failedCheckIds
            : [],
        frameNonce: 42,
        mode: 'frame',
        camera: 'front',
        cameraMatrix: [1, 0, 0, 0],
        clipId: null,
        playing: false,
        observedTimeSeconds: 0,
        completedCycles: 0,
        previewIssues: [],
        reviewChecks: []
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
  const invalidClipInspect = port.inspect({
    kind: 'clip',
    ids: ['idle']
  } as unknown as {
    kind: 'clip';
    id: string;
  });
  assert.equal(invalidClipInspect.ok, false);
  if (!invalidClipInspect.ok) {
    assert.equal(invalidClipInspect.error.path, 'ids');
  }
  assert.equal(
    port.inspect({
      kind: 'clip',
      id: 'idle',
      trackId: 'animation:idle:channel:body:rotation',
      limit: 25
    }).ok,
    true
  );
  assert.deepEqual(
    await port.present({
      review: 'next'
    }),
    {
      ok: true,
      revision: 'local-0001',
      data: {
        review: 'next',
        purpose: 'delivery',
        milestone: null,
        verdict: 'pending',
        issues: [],
        acknowledgedCheckIds: [],
        failedCheckIds: [],
        frameNonce: 42,
        mode: 'frame',
        camera: 'front',
        cameraMatrix: [1, 0, 0, 0],
        clipId: null,
        playing: false,
        observedTimeSeconds: 0,
        completedCycles: 0,
        previewIssues: [],
        reviewChecks: []
      }
    }
  );
  const acceptedFrame = await port.present({
    review: 'accept',
    frameNonce: 42,
    checkIds: []
  });
  assert.equal(acceptedFrame.ok, true);
  if (acceptedFrame.ok) {
    assert.equal(acceptedFrame.data.verdict, 'accepted');
    assert.deepEqual(acceptedFrame.data.issues, []);
  }
  const rejectedFrame = await port.present({
    review: 'reject',
    frameNonce: 42,
    issues: ['connection', 'material'],
    failedCheckIds: []
  });
  assert.equal(rejectedFrame.ok, true);
  if (rejectedFrame.ok) {
    assert.equal(rejectedFrame.data.verdict, 'rejected');
    assert.deepEqual(
      rejectedFrame.data.issues,
      ['connection', 'material']
    );
  }
  const emptyRejection = await port.present({
    review: 'reject',
    frameNonce: 42,
    issues: [],
    failedCheckIds: []
  });
  assert.equal(emptyRejection.ok, false);
  if (!emptyRejection.ok) {
    assert.equal(emptyRejection.error.path, 'issues');
  }
  const milestonePreview = await port.present({
    review: 'preview',
    milestone: 'specialists',
    camera: 'front'
  });
  assert.equal(milestonePreview.ok, true);
  if (milestonePreview.ok) {
    assert.equal(milestonePreview.data.purpose, 'preview');
    assert.equal(milestonePreview.data.milestone, 'specialists');
  }
  const invalidMilestone = await port.present({
    review: 'preview',
    milestone: 'texture'
  } as unknown as PresentRequest);
  assert.equal(invalidMilestone.ok, false);
  if (!invalidMilestone.ok) {
    assert.equal(invalidMilestone.error.path, 'milestone');
  }
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
    receipt: compactCommandReceipt(
      receipt('agent-request:request-port-test')
    )
  });
  assert.equal(submits, 1);
  assert.deepEqual(submitted[0], {
    batchId: 'agent-request:request-port-test',
    baseProjectId: 'project-test',
    baseRevision: 'local-0001',
    operations: runRequest().operations
  });
  assert.deepEqual(statuses, [
    'working',
    'connected',
    'working',
    'connected',
    'working',
    'connected',
    'working',
    'connected',
    'working',
    'connected'
  ]);

  const retried = await port.run(runRequest());
  assert.equal(retried.ok, true);
  assert.equal(submits, 1);

  const secondResult = await port.run(runRequest('Second request'));
  assert.equal(secondResult.ok, true);
  assert.equal(submits, 2);
}

{
  let submits = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-long-session',
    currentRevision: () => 'local-0001',
    submit: async (batch) => {
      submits += 1;
      return committed(batch.batchId);
    }
  });
  const requests = Array.from(
    { length: 140 },
    (_, index) => runRequest(`Long session ${index}`)
  );
  for (const request of requests) {
    assert.equal((await port.run(request)).ok, true);
  }
  assert.equal(submits, requests.length);
  assert.deepEqual(
    await port.run(requests[0]),
    await port.run(requests[0])
  );
  assert.equal(
    submits,
    requests.length,
    'completed request identity must survive the complete page session'
  );
}

{
  let submittedName = '';
  let submits = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-snapshot',
    currentRevision: () => 'local-0001',
    submit: async (batch) => {
      submits += 1;
      submittedName = (
        batch.operations[0].payload as { name: string }
      ).name;
      return committed(batch.batchId);
    }
  });
  const mutable = runRequest('Snapshot original') as {
    requestId: string;
    operations: {
      name: 'project.rename';
      payload: { name: string };
    }[];
  };
  const pending = port.run(mutable);
  mutable.operations[0].payload.name = 'Mutated after submit';
  assert.equal((await pending).ok, true);
  assert.equal(
    submittedName,
    'Snapshot original',
    'signature and submission must use one immutable boundary snapshot'
  );
  const replay = await port.run(
    runRequest('Snapshot original')
  );
  assert.equal(replay.ok, true);
  assert.equal(submits, 1);
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
      gameVersion: null,
      contentHash: 'sha256:test',
      adaptationCount: 0,
      adaptations: { converted: [], omitted: [] }
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
    requestId: 'invalid-empty',
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
    requestId: 'unknown-operation-property',
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
    requestId: 'raw-geometry',
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
    requestId: value.requestId,
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
  resolveSubmit(committed('agent-request:request-port-test'));
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
  await new Promise<void>((resolve) => setImmediate(resolve));
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
      review: 'next',
      purpose: 'delivery',
      milestone: null,
      verdict: 'pending',
      issues: [],
      acknowledgedCheckIds: [],
      failedCheckIds: [],
      frameNonce: 1,
      mode: 'frame',
      camera: 'front',
      cameraMatrix: [1, 0, 0, 0],
      clipId: null,
      playing: false,
      observedTimeSeconds: 0,
      completedCycles: 0,
      previewIssues: [],
      reviewChecks: []
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
  let projectGeneration = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => currentProjectId,
    currentProjectSession: () =>
      `${projectGeneration}:${currentProjectId}`,
    currentRevision: () => 'local-0001',
    submit: async (value) => {
      submits += 1;
      assert.equal(value.batchId, 'agent-request:repeat-run');
      assert.equal(value.baseProjectId, 'project-old');
      currentProjectId = 'project-new';
      projectGeneration = 1;
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
  ): Omit<AgentRunRequest, 'requestId'> => ({
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

  projectGeneration = 2;
  dispatchRun('Bridge project');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    submits,
    1,
    'a completed request must not replay into a replaced project session'
  );
  const crossProjectResult = JSON.parse(
    resultElement.attributes.get(
      'data-agent-command-port-result'
    ) ?? '{}'
  ).result;
  assert.equal(crossProjectResult.ok, false);
  assert.equal(crossProjectResult.error.path, 'requestId');
  assert.match(
    crossProjectResult.error.expected,
    /active project session/
  );
  disconnect();
}

{
  const fakeDocument = new FakeDocument();
  const fakeWindow = { document: fakeDocument };
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-envelope',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId)
  });
  const disconnect = port.connect(fakeWindow as unknown as Window);
  const input = fakeDocument.body.children.find(
    (child) =>
      child.attributes.has('data-agent-command-port-input')
  );
  const resultElement = fakeDocument.head.children.find(
    (child) =>
      child.attributes.has('data-agent-command-port-result')
  );
  assert.ok(input);
  assert.ok(resultElement);
  input.value = JSON.stringify({
    requestId: 'invalid envelope id',
    method: 'inspect',
    unexpected: true
  });
  input.dispatch('input');
  await new Promise<void>((resolve) => setImmediate(resolve));
  const response = JSON.parse(
    resultElement.attributes.get(
      'data-agent-command-port-result'
    ) ?? '{}'
  );
  assert.equal(response.requestId, null);
  assert.equal(response.result.ok, false);
  assert.equal(response.result.error.code, 'invalid_request');
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
  await new Promise<void>((resolve) => setImmediate(resolve));

  const queuedInput = currentInput();
  queuedInput.value = JSON.stringify({
    requestId: 'queued-run',
    method: 'run',
    payload: {
      operations: runRequest().operations
    }
  });
  queuedInput.dispatch('input');
  disconnect();
  assert.ok(resolvePresentation);
  resolvePresentation({
    ok: true,
    revision: 'local-0001',
    data: {
      review: 'next',
      purpose: 'delivery',
      milestone: null,
      verdict: 'pending',
      issues: [],
      acknowledgedCheckIds: [],
      failedCheckIds: [],
      frameNonce: 1,
      mode: 'frame',
      camera: 'front',
      cameraMatrix: [1, 0, 0, 0],
      clipId: null,
      playing: false,
      observedTimeSeconds: 0,
      completedCycles: 0,
      previewIssues: [],
      reviewChecks: []
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
  let captures = 0;
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
    capture: async () => {
      captures += 1;
      return captured();
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
    const blockedCapture = await port.capture({ kind: 'result' });
    assert.equal(blockedCapture.ok, false);
    if (!blockedCapture.ok) {
      assert.equal(blockedCapture.error.code, 'busy');
    }
    fileLease.release();
  }
  assert.equal(submits, 0);
  assert.equal(deliveries, 0);
  assert.equal(captures, 0);
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
  resolveSubmit(
    committed('agent-request:request-lease-held-by-run')
  );
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
          gameVersion: null,
          contentHash: 'sha256:test',
          adaptationCount: 0,
          adaptations: { converted: [], omitted: [] }
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

{
  const operationLease = createOperationLease();
  const statuses: AgentCommandPortStatus[] = [];
  const observedRequests: AgentCaptureRequest[] = [];
  let captures = 0;
  let presentations = 0;
  let deliveries = 0;
  let resolveCapture:
    ((result: CaptureResult) => void) | undefined;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId),
    present: async () => {
      presentations += 1;
      throw new Error('must not present during capture');
    },
    capture: (request, lease) => {
      captures += 1;
      observedRequests.push(request);
      assert.equal(operationLease.isActive(lease), true);
      return new Promise<CaptureResult>((resolve) => {
        resolveCapture = resolve;
      });
    },
    deliver: async () => {
      deliveries += 1;
      throw new Error('must not deliver during capture');
    },
    operationLease,
    onStatusChange: (status) => statuses.push(status)
  });

  const first = port.capture({
    kind: 'animation',
    clipId: 'idle'
  });
  const duplicate = port.capture({
    clipId: 'idle',
    kind: 'animation'
  });
  assert.equal(
    duplicate,
    first,
    'an identical active capture must return the same promise'
  );
  assert.equal(operationLease.currentOwner(), 'agent.capture');

  const competingCapture = await port.capture({ kind: 'build' });
  assert.equal(competingCapture.ok, false);
  if (!competingCapture.ok) {
    assert.equal(competingCapture.error.code, 'busy');
  }
  const competingRun = await port.run(
    runRequest('Blocked by capture')
  );
  assert.equal(competingRun.ok, false);
  const competingPresent = await port.present({ review: 'next' });
  assert.equal(competingPresent.ok, false);
  const competingDelivery = await port.deliver();
  assert.equal(competingDelivery.ok, false);
  if (!competingDelivery.ok) {
    assert.equal(competingDelivery.error.code, 'busy');
  }
  assert.equal(presentations, 0);
  assert.equal(deliveries, 0);

  await Promise.resolve();
  assert.equal(captures, 1);
  assert.deepEqual(observedRequests, [{
    kind: 'animation',
    clipId: 'idle'
  }]);
  assert.ok(resolveCapture);
  resolveCapture(captured('animation'));
  const result = await first;
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.artifact.kind, 'animation');
    assert.equal(Object.hasOwn(result.artifact, 'bytes'), false);
  }
  assert.equal(operationLease.currentOwner(), null);
  assert.deepEqual(statuses, ['working', 'connected']);
}

{
  let captures = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId),
    capture: async () => {
      captures += 1;
      return captured();
    }
  });

  for (const request of [
    { kind: 'result', clipId: 'idle' },
    { kind: 'animation', clipId: '' },
    { kind: 'animation', clipId: 'x'.repeat(129) },
    { kind: 'animation', unexpected: true },
    { kind: 'unknown' }
  ]) {
    const result = await port.capture(
      request as unknown as AgentCaptureRequest
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_request');
    }
  }
  assert.equal(captures, 0);
}

for (const [failure, expectedCode] of [
  [
    Object.assign(new Error('cancelled'), { name: 'AbortError' }),
    'cancelled'
  ],
  [new Error('unexpected'), 'capture_failed']
] as const) {
  const operationLease = createOperationLease();
  const statuses: AgentCommandPortStatus[] = [];
  let captures = 0;
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: null
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId),
    capture: () => {
      captures += 1;
      if (captures === 1) throw failure;
      return Promise.resolve(captured());
    },
    operationLease,
    onStatusChange: (status) => statuses.push(status)
  });

  const failed = await port.capture({ kind: 'result' });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, expectedCode);
  assert.equal(operationLease.currentOwner(), null);
  assert.equal((await port.capture({ kind: 'result' })).ok, true);
  assert.equal(operationLease.currentOwner(), null);
  assert.deepEqual(statuses, [
    'working',
    'connected',
    'working',
    'connected'
  ]);
}

{
  const fakeDocument = new FakeDocument();
  const fakeWindow = { document: fakeDocument };
  let resolveCapture:
    ((result: CaptureResult) => void) | undefined;
  const observedRequests: AgentCaptureRequest[] = [];
  const port = new AgentCommandPort({
    inspect: () => ({
      ok: true,
      revision: 'local-0001',
      data: { state: 'inspected' }
    }),
    currentProjectId: () => 'project-test',
    currentRevision: () => 'local-0001',
    submit: async (batch) => committed(batch.batchId),
    capture: (request) => {
      observedRequests.push(request);
      return new Promise<CaptureResult>((resolve) => {
        resolveCapture = resolve;
      });
    }
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

  const captureInput = currentInput();
  captureInput.value = JSON.stringify({
    requestId: 'capture-first',
    method: 'capture',
    payload: {
      kind: 'animation',
      clipId: 'idle'
    }
  });
  captureInput.dispatch('input');
  await new Promise<void>((resolve) => setImmediate(resolve));

  const inspectInput = currentInput();
  inspectInput.value = JSON.stringify({
    requestId: 'inspect-after-capture',
    method: 'inspect'
  });
  inspectInput.dispatch('input');
  assert.ok(resolveCapture);
  resolveCapture(captured('animation'));
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(observedRequests, [{
    kind: 'animation',
    clipId: 'idle'
  }]);
  const responses = resultElement.attributeWrites
    .filter(
      (write) =>
        write.name === resultAttribute &&
        write.value.length > 0
    )
    .map((write) => JSON.parse(write.value).requestId);
  assert.deepEqual(responses, [
    'capture-first',
    'inspect-after-capture'
  ]);
  disconnect();
}
})();
