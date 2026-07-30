import type {
  CommandBatch
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../workbench/state/commandOutcome';
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

export type AgentCommandPortStatus = 'connected' | 'working';

export interface AgentCommandPortDependencies {
  inspect: (request?: InspectRequest) => InspectResult;
  currentRevision: () => string;
  submit: (batch: CommandBatch) => Promise<CommandOutcome>;
  present?: (request: PresentRequest) => PresentResult;
  onStatusChange?: (status: AgentCommandPortStatus) => void;
}

interface ActiveBatch {
  batchId: string;
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
    const value = JSON.stringify(batch);
    return typeof value === 'string' ? value : null;
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
      error: outcome.error
    };
  }
  return {
    ok: true,
    revision: outcome.receipt.revision,
    receipt: outcome.receipt
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
      const previous = input;
      input = createInput();
      previous.removeEventListener('input', receive);
      previous.remove();
      resultElement.setAttribute(
        agentCommandProtocol.resultAttribute,
        JSON.stringify({ requestId, result: commandResult })
      );
    }
    function receive(): void {
      const request = parseSerializedAgentCommandInput(input.value);
      input.value = '';
      input.blur();
      if (!request) {
        respond(null, {
          ok: false,
          revision: port.dependencies.currentRevision(),
          error: {
            code: 'invalid_request',
            path: '$',
            expected: 'agent command request'
          }
        });
        return;
      }
      if (request.method === 'inspect') {
        respond(
          request.requestId,
          port.inspect(request.payload as InspectRequest | undefined)
        );
        return;
      }
      if (request.method === 'present') {
        respond(
          request.requestId,
          port.present(request.payload as PresentRequest)
        );
        return;
      }
      void port.run(request.payload as CommandBatch)
        .then((result) => respond(request.requestId, result));
    }

    host.ashfox = this;
    input = createInput();
    return () => {
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

  present(input: PresentRequest): PresentResult {
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
      return {
        ok: false,
        revision,
        error: parsed.error
      };
    }
    if (!this.dependencies.present) {
      return {
        ok: false,
        revision,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'connected presentation adapter'
        }
      };
    }
    try {
      return this.dependencies.present(parsed.request);
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

    const completed = this.completedBatches.get(parsed.batch.batchId);
    if (completed) {
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
        this.activeBatch.batchId === parsed.batch.batchId &&
        this.activeBatch.signature === signature
      ) {
        return this.activeBatch.result;
      }
      return Promise.resolve(
        terminalFailure(revision, 'Another command batch is already running.')
      );
    }

    const result = this.execute(parsed.batch, signature);
    this.activeBatch = {
      batchId: parsed.batch.batchId,
      signature,
      result
    };
    return result;
  }

  private async execute(
    batch: CommandBatch,
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
    this.remember(batch.batchId, signature, result);
    return result;
  }

  private remember(
    batchId: string,
    signature: string,
    result: RunResult
  ): void {
    this.completedBatches.set(batchId, { signature, result });
  }

  private updateStatus(status: AgentCommandPortStatus): void {
    try {
      this.dependencies.onStatusChange?.(status);
    } catch {
      // Status observation cannot alter command termination.
    }
  }
}
