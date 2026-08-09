import type {
  CommandBatch
} from '@ashfox/engine-core';

import type {
  OperationLeaseToken
} from '../../../application/operationLease';
import type {
  AgentCaptureRequest,
  CaptureResult,
  PresentRequest,
  PresentResult,
  RunResult
} from '../types';
import {
  isAbortError,
  runResultFromOutcome,
  terminalRunFailure
} from './agentCommandResults';
import {
  executeLeasedOperation
} from './executeLeasedOperation';
import type {
  AgentCommandPortDependencies,
  AgentCommandPortStatus
} from './agentCommandPortTypes';

export class AgentOperationExecutor {
  constructor(
    private readonly dependencies: AgentCommandPortDependencies
  ) {}

  run(
    batch: CommandBatch,
    lease: OperationLeaseToken,
    finish: () => void
  ): Promise<RunResult> {
    return executeLeasedOperation({
      lease,
      start: () => this.updateStatus('working'),
      cleanup: finish,
      complete: () => this.updateStatus('connected'),
      execute: async () => runResultFromOutcome(
        await this.dependencies.submit(batch)
      ),
      failure: (error) => terminalRunFailure(
        this.dependencies.currentRevision(),
        isAbortError(error)
          ? 'Command batch was cancelled.'
          : 'Command batch could not be submitted.'
      )
    });
  }

  capture(
    request: AgentCaptureRequest,
    lease: OperationLeaseToken,
    finish: () => void
  ): Promise<CaptureResult> {
    const capture = this.dependencies.capture;
    if (!capture) {
      throw new Error('Capture adapter is unavailable.');
    }
    return executeLeasedOperation({
      lease,
      start: () => this.updateStatus('working'),
      cleanup: finish,
      complete: () => this.updateStatus('connected'),
      execute: () => capture(request, lease),
      failure: (error) => ({
        ok: false,
        revision: this.dependencies.currentRevision(),
        error: {
          code: isAbortError(error)
            ? 'cancelled'
            : 'capture_failed',
          message: isAbortError(error)
            ? 'Capture was cancelled.'
            : 'Capture could not be completed.'
        }
      })
    });
  }

  present(
    request: PresentRequest,
    lease: OperationLeaseToken,
    finish: () => void
  ): Promise<PresentResult> {
    const present = this.dependencies.present;
    if (!present) {
      throw new Error('Presentation adapter is unavailable.');
    }
    return executeLeasedOperation({
      lease,
      start: () => this.updateStatus('working'),
      cleanup: finish,
      complete: () => this.updateStatus('connected'),
      execute: () => present(request),
      failure: () => ({
        ok: false,
        revision: this.dependencies.currentRevision(),
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'valid presentation request'
        }
      })
    });
  }

  private updateStatus(status: AgentCommandPortStatus): void {
    try {
      this.dependencies.onStatusChange?.(status);
    } catch {
      return;
    }
  }
}
