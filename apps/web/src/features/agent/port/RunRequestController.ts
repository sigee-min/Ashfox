import {
  canonicalJsonString
} from '@ashfox/engine-core';

import {
  parseRunRequest
} from '../parseRunRequest';
import type {
  AgentRunRequest,
  RunResult
} from '../types';
import {
  invalidBatchResult
} from './agentCommandResults';
import type {
  AgentCommandPortDependencies
} from './agentCommandPortTypes';
import type {
  AgentPortLifecycle
} from './AgentPortLifecycle';

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

const requestSignature = (
  request: AgentRunRequest
): string | null => {
  try {
    return canonicalJsonString(request);
  } catch {
    return null;
  }
};

export class RunRequestController {
  constructor(
    private readonly dependencies: AgentCommandPortDependencies,
    private readonly lifecycle: AgentPortLifecycle
  ) {}

  runConnected(input: unknown, requestId: string): Promise<RunResult> {
    if (!isRecord(input) || 'requestId' in input) {
      return Promise.resolve(
        invalidBatchResult(
          this.dependencies.currentRevision(),
          '$',
          'DOM run payload with operations only'
        )
      );
    }
    return this.run({ requestId, ...input });
  }

  run(input: unknown): Promise<RunResult> {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parseRunRequest>;
    try {
      parsed = parseRunRequest(input);
    } catch {
      return Promise.resolve(
        invalidBatchResult(revision, '$', 'plain run request data')
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
        invalidBatchResult(revision, '$', 'plain JSON run request data')
      );
    }
    const signature = requestSignature(request);
    if (signature === null) {
      return Promise.resolve(
        invalidBatchResult(revision, '$', 'JSON-serializable run request')
      );
    }
    const projectId = this.dependencies.currentProjectId();
    return this.lifecycle.run({
      request,
      signature,
      revision,
      projectId,
      projectSession:
        this.dependencies.currentProjectSession?.() ?? projectId
    });
  }
}
