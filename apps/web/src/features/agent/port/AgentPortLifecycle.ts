import type {
  CommandBatch
} from '@ashfox/engine-core';

import {
  createOperationLease,
  type OperationLease
} from '../../../application/operationLease';
import type {
  AgentCaptureRequest,
  AgentRunRequest,
  CaptureResult,
  PresentRequest,
  PresentResult,
  RunResult
} from '../types';
import {
  invalidBatchResult,
  terminalRunFailure
} from './agentCommandResults';
import type {
  AgentCommandPortDependencies
} from './agentCommandPortTypes';
import {
  AgentOperationExecutor
} from './AgentOperationExecutor';

interface ActiveRun {
  signature: string;
  result: Promise<RunResult>;
}

interface ActiveCapture {
  signature: string;
  result: Promise<CaptureResult>;
}

interface CompletedRun {
  signature: string;
  result: RunResult;
  projectSessions: ReadonlySet<string>;
}

export interface PreparedRunRequest {
  request: AgentRunRequest;
  signature: string;
  revision: string;
  projectId: string;
  projectSession: string;
}

export class AgentPortLifecycle {
  private activeRun: ActiveRun | null = null;
  private activePresentation: Promise<PresentResult> | null = null;
  private activeCapture: ActiveCapture | null = null;
  private readonly completedRuns = new Map<string, CompletedRun>();
  private readonly operationLease: OperationLease;
  private readonly executor: AgentOperationExecutor;

  constructor(
    private readonly dependencies: AgentCommandPortDependencies
  ) {
    this.operationLease =
      dependencies.operationLease ?? createOperationLease();
    this.executor = new AgentOperationExecutor(dependencies);
  }

  present(request: PresentRequest): Promise<PresentResult> {
    const revision = this.dependencies.currentRevision();
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
      this.activeRun ||
      this.activeCapture ||
      this.activePresentation
    ) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'invalid_state',
          path: '$',
          expected: 'no other active agent operation'
        }
      });
    }
    const lease = this.operationLease.tryAcquire('agent.present');
    if (!lease) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'invalid_state',
          path: '$',
          expected:
            `available operation lease; active owner is ${this.operationLease.currentOwner() ?? 'unknown'}`
        }
      });
    }
    const result = this.executor.present(request, lease, () => {
      this.activePresentation = null;
    });
    this.activePresentation = result;
    return result;
  }

  capture(
    request: AgentCaptureRequest,
    signature: string
  ): Promise<CaptureResult> {
    const revision = this.dependencies.currentRevision();
    if (!this.dependencies.capture) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'invalid_state',
          path: '$',
          expected: 'connected capture adapter'
        }
      });
    }
    if (this.activeCapture) {
      return this.activeCapture.signature === signature
        ? this.activeCapture.result
        : Promise.resolve({
            ok: false,
            revision,
            error: {
              code: 'busy',
              message: 'Another capture is still running.'
            }
          });
    }
    if (
      this.activeRun ||
      this.activePresentation
    ) {
      return Promise.resolve({
        ok: false,
        revision,
        error: {
          code: 'busy',
          message: 'Another agent operation is still running.'
        }
      });
    }
    const lease = this.operationLease.tryAcquire('agent.capture');
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
    const result = this.executor.capture(request, lease, () => {
      this.activeCapture = null;
    });
    this.activeCapture = { signature, result };
    return result;
  }

  run(prepared: PreparedRunRequest): Promise<RunResult> {
    const {
      request,
      signature,
      revision,
      projectId,
      projectSession
    } = prepared;
    const completed = this.completedRuns.get(request.requestId);
    if (completed) {
      return Promise.resolve(
        completed.signature !== signature
          ? invalidBatchResult(
              revision,
              'requestId',
              'a request ID that has not been used for different content'
            )
          : !completed.projectSessions.has(projectSession)
            ? invalidBatchResult(
                revision,
                'requestId',
                'a request ID from the active project session'
              )
            : completed.result
      );
    }
    const conflict = this.runConflict(signature, revision);
    if (conflict) return conflict;

    const batch: CommandBatch = {
      batchId: `agent-request:${request.requestId}`,
      baseProjectId: projectId,
      baseRevision: revision,
      operations: request.operations
    };
    const lease = this.operationLease.tryAcquire('agent.run');
    if (!lease) {
      return Promise.resolve(
        terminalRunFailure(
          revision,
          `Another operation is still running (${this.operationLease.currentOwner() ?? 'unknown'}).`
        )
      );
    }
    const result = this.executor.run(batch, lease, () => {
      this.activeRun = null;
    }).then((outcome) => {
      this.completedRuns.set(request.requestId, {
        signature,
        result: outcome,
        projectSessions: new Set([
          projectSession,
          this.dependencies.currentProjectSession?.() ??
            this.dependencies.currentProjectId()
        ])
      });
      return outcome;
    });
    this.activeRun = { signature, result };
    return result;
  }

  private runConflict(
    signature: string,
    revision: string
  ): Promise<RunResult> | null {
    if (this.activeRun) {
      return this.activeRun.signature === signature
        ? this.activeRun.result
        : Promise.resolve(
            terminalRunFailure(
              revision,
              'Another command batch is already running.'
            )
          );
    }
    if (this.activePresentation) {
      return Promise.resolve(
        terminalRunFailure(revision, 'A visual review is still running.')
      );
    }
    if (this.activeCapture) {
      return Promise.resolve(
        terminalRunFailure(revision, 'A capture is still running.')
      );
    }
    return null;
  }
}
