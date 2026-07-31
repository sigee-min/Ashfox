import {
  canonicalJsonString,
  type CommandBatch
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../../application/commandOutcome';
import {
  createOperationLease,
  type OperationLease,
  type OperationLeaseToken
} from '../../application/operationLease';
import { parseRunRequest } from './parseRunRequest';
import { parseInspectRequest } from './parseInspectRequest';
import { parsePresentRequest } from './parsePresentRequest';
import type {
  AgentRunRequest,
  AgentCommandPortApi,
  DeliverResult,
  InspectRequest,
  InspectResult,
  PresentRequest,
  PresentResult,
  RunResult
} from './types';
import { agentCommandProtocol } from './agentCommandProtocol';
import {
  isAgentRequestId
} from './agentRequestId';
import { compactCommandReceipt } from './compactReceipt';

export type AgentCommandPortStatus = 'connected' | 'working';

export interface AgentCommandPortDependencies {
  inspect: (request?: InspectRequest) => InspectResult;
  currentProjectId: () => string;
  currentProjectSession?: () => string;
  currentRevision: () => string;
  submit: (batch: CommandBatch) => Promise<CommandOutcome>;
  present?: (request: PresentRequest) => Promise<PresentResult>;
  deliver?: (lease: OperationLeaseToken) => Promise<DeliverResult>;
  operationLease?: OperationLease;
  onStatusChange?: (status: AgentCommandPortStatus) => void;
}

interface ActiveBatch {
  signature: string;
  result: Promise<RunResult>;
}

interface CompletedRequest {
  signature: string;
  result: RunResult;
  projectSessions: ReadonlySet<string>;
}

interface AgentCommandInput {
  requestId: string;
  method: 'inspect' | 'run' | 'present' | 'deliver';
  payload?: unknown;
}

const AGENT_COMMAND_INPUT_KEYS =
  new Set(['requestId', 'method', 'payload']);

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseAgentCommandInput = (
  value: unknown
): AgentCommandInput | null => {
  if (
    !isRecord(value) ||
    !isAgentRequestId(value.requestId) ||
    Object.keys(value).some(
      (key) => !AGENT_COMMAND_INPUT_KEYS.has(key)
    ) ||
    (
      value.method !== 'inspect' &&
      value.method !== 'run' &&
      value.method !== 'present' &&
      value.method !== 'deliver'
    )
  ) {
    return null;
  }
  return {
    requestId: value.requestId,
    method: value.method,
    payload: value.payload
  };
};

const parseSerializedAgentCommandInput = (
  value: string
): AgentCommandInput | null => {
  try {
    return parseAgentCommandInput(JSON.parse(value));
  } catch {
    return null;
  }
};

const requestSignature = (
  request: AgentRunRequest
): string | null => {
  try {
    return canonicalJsonString(request);
  } catch {
    return null;
  }
};

const invalidBatch = (
  revision: string,
  path: string,
  expected: string
): RunResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_batch',
    message: 'Command batch is invalid.',
    path,
    expected
  }
});

const terminalFailure = (
  revision: string,
  message: string
): RunResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_state',
    message
  }
});

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === 'AbortError';

const resultFromOutcome = (outcome: CommandOutcome): RunResult => {
  if (outcome.status === 'rejected') {
    return {
      ok: false,
      revision: outcome.revision,
      error: outcome.error,
      ...(outcome.findings
        ? { findings: outcome.findings }
        : {}),
      ...(outcome.findingsTruncated !== undefined
        ? { findingsTruncated: outcome.findingsTruncated }
        : {})
    };
  }
  return {
    ok: true,
    revision: outcome.receipt.revision,
    receipt: compactCommandReceipt(outcome.receipt)
  };
};

export class AgentCommandPort implements AgentCommandPortApi {
  private activeBatch: ActiveBatch | null = null;
  private activePresentation: Promise<PresentResult> | null = null;
  private activeDelivery: Promise<DeliverResult> | null = null;
  private readonly completedRequests =
    new Map<string, CompletedRequest>();
  private readonly operationLease: OperationLease;

  constructor(private readonly dependencies: AgentCommandPortDependencies) {
    this.operationLease =
      dependencies.operationLease ?? createOperationLease();
  }

  connect(host: Window): () => void {
    const port = this;
    const resultElement = host.document.createElement('meta');
    resultElement.setAttribute(agentCommandProtocol.resultAttribute, '');
    host.document.head.append(resultElement);
    let connected = true;
    let responseQueue = Promise.resolve();
    let input: HTMLInputElement;
    const createInput = (): HTMLInputElement => {
      const next = host.document.createElement('input');
      next.type = 'text';
      next.tabIndex = -1;
      next.setAttribute('aria-hidden', 'true');
      next.setAttribute('role', 'none');
      next.setAttribute(agentCommandProtocol.inputAttribute, '');
      Object.assign(next.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '1px',
        height: '1px',
        padding: '0',
        border: '0',
        opacity: '0',
        pointerEvents: 'none'
      });
      next.addEventListener('input', receive);
      host.document.body.append(next);
      return next;
    };
    function respond(requestId: string | null, commandResult: unknown): void {
      if (!connected) return;
      resultElement.setAttribute(
        agentCommandProtocol.resultAttribute,
        JSON.stringify({ requestId, result: commandResult })
      );
    }
    async function executeRequest(
      serialized: string
    ): Promise<readonly [string | null, unknown]> {
      const request = parseSerializedAgentCommandInput(serialized);
      if (!request) {
        return [null, {
          ok: false,
          revision: port.dependencies.currentRevision(),
          error: {
            code: 'invalid_request',
            path: '$',
            expected: 'agent command request'
          }
        }];
      }
      if (request.method === 'inspect') {
        return [
          request.requestId,
          port.inspect(request.payload as InspectRequest | undefined)
        ];
      }
      if (request.method === 'present') {
        return [
          request.requestId,
          await port.present(request.payload as PresentRequest)
        ];
      }
      if (request.method === 'deliver') {
        return [
          request.requestId,
          request.payload === undefined
            ? await port.deliver()
            : {
                ok: false,
                revision: port.dependencies.currentRevision(),
                error: {
                  code: 'invalid_state',
                  path: 'payload',
                  expected: 'no deliver payload'
                }
              }
        ];
      }
      return [
        request.requestId,
        await port.runConnected(
          request.payload,
          request.requestId
        )
      ];
    }
    function receive(this: HTMLInputElement): void {
      const source = this;
      const serialized = source.value;
      source.value = '';
      source.blur();
      source.removeEventListener('input', receive);
      source.remove();
      if (connected && source === input) input = createInput();

      responseQueue = responseQueue
        .then(async () => {
          if (!connected) return;
          const [requestId, result] =
            await executeRequest(serialized);
          if (connected) respond(requestId, result);
        })
        .catch(() => {
          if (!connected) return;
          respond(null, {
            ok: false,
            revision: port.dependencies.currentRevision(),
            error: {
              code: 'invalid_state',
              message: 'Agent command could not be completed.'
            }
          });
        });
    }

    host.ashfox = this;
    input = createInput();
    return () => {
      connected = false;
      input.removeEventListener('input', receive);
      input.remove();
      resultElement.remove();
      if (host.ashfox === this) delete host.ashfox;
    };
  }

  inspect(request?: InspectRequest): InspectResult {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parseInspectRequest>;
    try {
      parsed = parseInspectRequest(request);
    } catch {
      parsed = {
        ok: false,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'plain inspect request data'
        }
      };
    }
    if (!parsed.ok) {
      return {
        ok: false,
        revision,
        error: parsed.error
      };
    }
    try {
      return this.dependencies.inspect(parsed.request);
    } catch {
      return {
        ok: false,
        revision,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'valid inspect request'
        }
      };
    }
  }

  async present(input: PresentRequest): Promise<PresentResult> {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parsePresentRequest>;
    try {
      parsed = parsePresentRequest(input);
    } catch {
      parsed = {
        ok: false,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'plain presentation request data'
        }
      };
    }
    if (!parsed.ok) {
      return Promise.resolve({
        ok: false,
        revision,
        error: parsed.error
      });
    }
    if (!this.dependencies.present) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'connected presentation adapter'
        }
      });
    }
    if (
      this.activeBatch ||
      this.activeDelivery ||
      this.activePresentation
    ) {
      return {
        ok: false,
        revision,
        error: {
          code: 'invalid_state',
          path: '$',
          expected: 'no other active agent operation'
        }
      };
    }
    const lease =
      this.operationLease.tryAcquire('agent.present');
    if (!lease) {
      return {
        ok: false,
        revision,
        error: {
          code: 'invalid_state',
          path: '$',
          expected:
            `available operation lease; active owner is ${this.operationLease.currentOwner() ?? 'unknown'}`
        }
      };
    }
    const result = this.executePresentation(
      parsed.request,
      lease
    );
    this.activePresentation = result;
    return result;
  }

  deliver(): Promise<DeliverResult> {
    const revision = this.dependencies.currentRevision();
    if (!this.dependencies.deliver) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'invalid_state',
          path: '$',
          expected: 'connected delivery adapter'
        }
      });
    }
    if (this.activeDelivery) return this.activeDelivery;
    if (this.activeBatch || this.activePresentation) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'busy',
          message: 'A project change is still running.'
        }
      });
    }
    const lease =
      this.operationLease.tryAcquire('agent.deliver');
    if (!lease) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'busy',
          message:
            `Another operation is still running (${this.operationLease.currentOwner() ?? 'unknown'}).`
        }
      });
    }
    const result = this.executeDelivery(lease);
    this.activeDelivery = result;
    return result;
  }

  run(input: AgentRunRequest): Promise<RunResult> {
    return this.runRequest(input);
  }

  private runConnected(
    input: unknown,
    requestId: string
  ): Promise<RunResult> {
    if (!isRecord(input) || 'requestId' in input) {
      return Promise.resolve(
        invalidBatch(
          this.dependencies.currentRevision(),
          '$',
          'DOM run payload with operations only'
        )
      );
    }
    return this.runRequest({
      requestId,
      ...input
    });
  }

  private runRequest(
    input: unknown
  ): Promise<RunResult> {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parseRunRequest>;
    try {
      parsed = parseRunRequest(input);
    } catch {
      return Promise.resolve(
        invalidBatch(revision, '$', 'plain run request data')
      );
    }
    if (!parsed.ok) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          ...parsed.error,
          message: 'Command batch is invalid.'
        }
      });
    }

    let request: AgentRunRequest;
    try {
      request = structuredClone(parsed.request);
    } catch {
      return Promise.resolve(
        invalidBatch(revision, '$', 'plain JSON run request data')
      );
    }
    const signature = requestSignature(request);
    if (signature === null) {
      return Promise.resolve(
        invalidBatch(revision, '$', 'JSON-serializable run request')
      );
    }
    const requestId = request.requestId;
    const currentProjectId =
      this.dependencies.currentProjectId();
    const currentProjectSession =
      this.dependencies.currentProjectSession?.() ??
      currentProjectId;
    const completed = this.completedRequests.get(requestId);
    if (completed) {
      return Promise.resolve(
        completed.signature !== signature
          ? invalidBatch(
              revision,
              'requestId',
              'a request ID that has not been used for different content'
            )
          : !completed.projectSessions.has(
              currentProjectSession
            )
            ? invalidBatch(
                revision,
                'requestId',
                'a request ID from the active project session'
              )
            : completed.result
      );
    }

    if (this.activeBatch) {
      if (
        this.activeBatch.signature === signature
      ) {
        return this.activeBatch.result;
      }
      return Promise.resolve(
        terminalFailure(revision, 'Another command batch is already running.')
      );
    }
    if (this.activeDelivery) {
      return Promise.resolve(
        terminalFailure(revision, 'Project delivery is still running.')
      );
    }
    if (this.activePresentation) {
      return Promise.resolve(
        terminalFailure(
          revision,
          'A visual review is still running.'
        )
      );
    }
    const batch: CommandBatch = {
      batchId: `agent-request:${requestId}`,
      baseProjectId: currentProjectId,
      baseRevision: revision,
      operations: request.operations
    };
    const lease =
      this.operationLease.tryAcquire('agent.run');
    if (!lease) {
      return Promise.resolve(
        terminalFailure(
          revision,
          `Another operation is still running (${this.operationLease.currentOwner() ?? 'unknown'}).`
        )
      );
    }
    const result = this.execute(batch, lease).then((outcome) => {
      this.completedRequests.set(requestId, {
        signature,
        result: outcome,
        projectSessions: new Set([
          currentProjectSession,
          this.dependencies.currentProjectSession?.() ??
            this.dependencies.currentProjectId()
        ])
      });
      return outcome;
    });
    this.activeBatch = {
      signature,
      result
    };
    return result;
  }

  private async execute(
    batch: CommandBatch,
    lease: OperationLeaseToken
  ): Promise<RunResult> {
    this.updateStatus('working');
    let result: RunResult;
    try {
      result = resultFromOutcome(
        await Promise.resolve().then(
          () => this.dependencies.submit(batch)
        )
      );
    } catch (error) {
      result = terminalFailure(
        this.dependencies.currentRevision(),
        isAbortError(error)
          ? 'Command batch was cancelled.'
          : 'Command batch could not be submitted.'
      );
    } finally {
      this.activeBatch = null;
      lease.release();
      this.updateStatus('connected');
    }
    return result;
  }

  private async executeDelivery(
    lease: OperationLeaseToken
  ): Promise<DeliverResult> {
    this.updateStatus('working');
    try {
      return await Promise.resolve().then(
        () => this.dependencies.deliver!(lease)
      );
    } catch {
      return {
        ok: false,
        revision: this.dependencies.currentRevision(),
        error: {
          code: 'export_failed',
          message: 'Project delivery could not be completed.'
        }
      };
    } finally {
      this.activeDelivery = null;
      lease.release();
      this.updateStatus('connected');
    }
  }

  private async executePresentation(
    request: PresentRequest,
    lease: OperationLeaseToken
  ): Promise<PresentResult> {
    this.updateStatus('working');
    try {
      return await Promise.resolve().then(
        () => this.dependencies.present!(request)
      );
    } catch {
      return {
        ok: false,
        revision: this.dependencies.currentRevision(),
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'valid presentation request'
        }
      };
    } finally {
      this.activePresentation = null;
      lease.release();
      this.updateStatus('connected');
    }
  }

  private updateStatus(status: AgentCommandPortStatus): void {
    try {
      this.dependencies.onStatusChange?.(status);
    } catch {
      // Status observation cannot alter command termination.
    }
  }
}
