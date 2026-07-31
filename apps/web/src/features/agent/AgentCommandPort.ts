import {
  canonicalJsonString,
  type CommandBatch
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../../application/commandOutcome';
import { parseCommandBatch } from './parseCommandBatch';
import { parseInspectRequest } from './parseInspectRequest';
import { parsePresentRequest } from './parsePresentRequest';
import type {
  AgentCommandPortApi,
  InspectRequest,
  InspectResult,
  PresentRequest,
  PresentResult,
  RunResult
} from './types';
import { agentCommandProtocol } from './agentCommandProtocol';
import { compactCommandReceipt } from './compactReceipt';

export type AgentCommandPortStatus = 'connected' | 'working';

export interface AgentCommandPortDependencies {
  inspect: (request?: InspectRequest) => InspectResult;
  currentProjectId: () => string;
  currentRevision: () => string;
  submit: (batch: CommandBatch) => Promise<CommandOutcome>;
  present?: (request: PresentRequest) => Promise<PresentResult>;
  onStatusChange?: (status: AgentCommandPortStatus) => void;
}

interface ActiveBatch {
  key: string;
  signature: string;
  result: Promise<RunResult>;
}

interface CompletedBatch {
  signature: string;
  result: RunResult;
}

interface AgentCommandInput {
  requestId: string;
  method: 'inspect' | 'run' | 'present';
  payload?: unknown;
}

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseAgentCommandInput = (
  value: unknown
): AgentCommandInput | null => {
  if (
    !isRecord(value) ||
    typeof value.requestId !== 'string' ||
    (
      value.method !== 'inspect' &&
      value.method !== 'run' &&
      value.method !== 'present'
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

const batchSignature = (batch: CommandBatch): string | null => {
  try {
    return canonicalJsonString(batch);
  } catch {
    return null;
  }
};

const batchScopeKey = (batch: CommandBatch): string =>
  JSON.stringify([batch.baseProjectId, batch.batchId]);

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

const projectMismatch = (
  revision: string,
  expectedProjectId: string
): RunResult => ({
  ok: false,
  revision,
  error: {
    code: 'project_mismatch',
    message: 'Batch project does not match the active project.',
    path: 'baseProjectId',
    expected: expectedProjectId
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
  private readonly completedBatches = new Map<string, CompletedBatch>();

  constructor(private readonly dependencies: AgentCommandPortDependencies) {}

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
      return [
        request.requestId,
        await port.run(request.payload as CommandBatch)
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
    try {
      return await this.dependencies.present(parsed.request);
    } catch {
      return {
        ok: false,
        revision,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'valid presentation request'
        }
      };
    }
  }

  run(input: CommandBatch): Promise<RunResult> {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parseCommandBatch>;
    try {
      parsed = parseCommandBatch(input);
    } catch {
      return Promise.resolve(
        invalidBatch(revision, '$', 'plain command batch data')
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

    const signature = batchSignature(parsed.batch);
    if (signature === null) {
      return Promise.resolve(
        invalidBatch(revision, '$', 'JSON-serializable command batch')
      );
    }
    const key = batchScopeKey(parsed.batch);
    const currentProjectId = this.dependencies.currentProjectId();

    const completed = this.completedBatches.get(key);
    if (completed) {
      const isProjectCreationReplay =
        completed.result.ok &&
        completed.result.receipt.projectId === currentProjectId;
      if (
        parsed.batch.baseProjectId !== currentProjectId &&
        !isProjectCreationReplay
      ) {
        return Promise.resolve(
          projectMismatch(revision, currentProjectId)
        );
      }
      return Promise.resolve(
        completed.signature === signature
          ? completed.result
          : invalidBatch(
              revision,
              'batchId',
              'a batch ID that has not been used for different content'
            )
      );
    }

    if (this.activeBatch) {
      if (
        this.activeBatch.key === key &&
        this.activeBatch.signature === signature
      ) {
        return this.activeBatch.result;
      }
      return Promise.resolve(
        terminalFailure(revision, 'Another command batch is already running.')
      );
    }
    if (parsed.batch.baseProjectId !== currentProjectId) {
      return Promise.resolve(projectMismatch(revision, currentProjectId));
    }

    const result = this.execute(parsed.batch, key, signature);
    this.activeBatch = {
      key,
      signature,
      result
    };
    return result;
  }

  private async execute(
    batch: CommandBatch,
    key: string,
    signature: string
  ): Promise<RunResult> {
    this.updateStatus('working');
    let result: RunResult;
    try {
      result = resultFromOutcome(await this.dependencies.submit(batch));
    } catch (error) {
      result = terminalFailure(
        this.dependencies.currentRevision(),
        isAbortError(error)
          ? 'Command batch was cancelled.'
          : 'Command batch could not be submitted.'
      );
    } finally {
      this.activeBatch = null;
      this.updateStatus('connected');
    }
    this.remember(key, signature, result);
    return result;
  }

  private remember(
    key: string,
    signature: string,
    result: RunResult
  ): void {
    this.completedBatches.set(key, { signature, result });
  }

  private updateStatus(status: AgentCommandPortStatus): void {
    try {
      this.dependencies.onStatusChange?.(status);
    } catch {
      // Status observation cannot alter command termination.
    }
  }
}
