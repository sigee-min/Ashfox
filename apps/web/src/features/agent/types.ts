import type {
  CommandBatch,
  CommandReceipt
} from '@ashfox/engine-core';

export type InspectRequest =
  | { kind: 'command'; name: string }
  | { kind: 'entity'; ids: readonly string[] }
  | { kind: 'texture'; ids: readonly string[] }
  | { kind: 'clip'; ids: readonly string[] }
  | { kind: 'target' }
  | { kind: 'finding'; path: string };

export interface InspectSuccess {
  ok: true;
  revision: string;
  data: unknown;
  truncated?: boolean;
}

export interface InspectFailure {
  ok: false;
  revision: string;
  error: {
    code: 'invalid_request' | 'not_found' | 'response_too_large';
    path?: string;
    expected?: string;
  };
}

export type InspectResult = InspectSuccess | InspectFailure;

export interface RunSuccess {
  ok: true;
  revision: string;
  receipt: CommandReceipt;
}

export interface RunFailure {
  ok: false;
  revision: string;
  error: {
    code: string;
    message?: string;
    path?: string;
    expected?: string;
  };
}

export type RunResult = RunSuccess | RunFailure;

export interface PresentRequest {
  kind: 'animation';
  clipId: string;
  playing: boolean;
  timeSeconds?: number;
}

export interface PresentSuccess {
  ok: true;
  revision: string;
  data: {
    clipId: string;
    playing: boolean;
    timeSeconds: number;
  };
}

export interface PresentFailure {
  ok: false;
  revision: string;
  error: {
    code: 'invalid_request' | 'not_found';
    path?: string;
    expected?: string;
  };
}

export type PresentResult = PresentSuccess | PresentFailure;

export interface AgentCommandPortApi {
  inspect(request?: InspectRequest): InspectResult;
  run(batch: CommandBatch): Promise<RunResult>;
  present(request: PresentRequest): PresentResult;
}

declare global {
  interface Window {
    ashfox?: AgentCommandPortApi;
  }
}
