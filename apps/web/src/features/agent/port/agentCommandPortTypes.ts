import type {
  CommandBatch
} from '@ashfox/engine-core';

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
  DeliverResult,
  InspectRequest,
  InspectResult,
  PresentRequest,
  PresentResult
} from '../types';

export type AgentCommandPortStatus = 'connected' | 'working';

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
  deliver?: (lease: OperationLeaseToken) => Promise<DeliverResult>;
  operationLease?: OperationLease;
  onStatusChange?: (status: AgentCommandPortStatus) => void;
}
