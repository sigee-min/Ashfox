import type { CommandBatch } from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../../../application/commandOutcome';
import type {
  OperationLease,
  OperationLeaseToken
} from '../../../application/operationLease';
import type {
  AgentCaptureRequest,
  CaptureResult,
  InspectRequest,
  InspectResult,
  PresentRequest,
  PresentResult
} from '../types';

export type AgentCommandPortStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'working';

export interface AgentCommandPortDependencies {
  inspect: (request?: InspectRequest) => InspectResult;
  currentProjectId: () => string;
  currentProjectSession?: () => string;
  currentRevision: () => string;
  submit: (batch: CommandBatch) => Promise<CommandOutcome>;
  present?: (request: PresentRequest) => Promise<PresentResult>;
  capture?: (
    request: AgentCaptureRequest,
    lease: OperationLeaseToken
  ) => Promise<CaptureResult>;
  operationLease?: OperationLease;
  onStatusChange?: (status: AgentCommandPortStatus) => void;
}
