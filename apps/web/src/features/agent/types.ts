import type {
  AnimationPreviewIssue,
  CommandSource,
  InvariantFinding,
  ProjectCommandOperation
} from '@ashfox/engine-core';
import type {
  CameraMode
} from '../../rendering/cameraPresets';

export type InspectRequest =
  | { kind: 'command'; name: string }
  | { kind: 'catalog'; cursor?: string; limit?: number }
  | { kind: 'parts'; ids: readonly string[] }
  | { kind: 'entity'; ids: readonly string[] }
  | { kind: 'texture'; ids: readonly string[] }
  | { kind: 'clip'; ids: readonly string[] }
  | { kind: 'activity'; cursor?: string; limit?: number }
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

export interface AgentReceiptEntityIds {
  ids: readonly string[];
  count: number;
  truncated: boolean;
}

export interface AgentCommandReceipt {
  schemaVersion: 1;
  commandId: string;
  projectId: string;
  actorId: string;
  source: CommandSource;
  summary: string;
  beforeRevision: string;
  revision: string;
  completedAt: string;
  durationMs: number;
  effects: {
    created: AgentReceiptEntityIds;
    changed: AgentReceiptEntityIds;
    removed: AgentReceiptEntityIds;
    invalidated: readonly string[];
  };
  findings: readonly InvariantFinding[];
  findingsTruncated: boolean;
}

export interface RunSuccess {
  ok: true;
  revision: string;
  receipt: AgentCommandReceipt;
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
  findings?: readonly InvariantFinding[];
  findingsTruncated?: boolean;
}

export type RunResult = RunSuccess | RunFailure;

export interface AgentRunRequest {
  operations: readonly ProjectCommandOperation[];
}

export interface PresentRequest {
  review: 'next';
}

export interface ViewPresentationRequest {
  mode: 'frame' | 'cycle';
  camera: CameraMode;
  clipId: string | null;
  timeSeconds: number;
}

export interface PresentSuccess {
  ok: true;
  revision: string;
  data: {
    frameNonce: number;
    mode: ViewPresentationRequest['mode'];
    camera: CameraMode;
    cameraMatrix: readonly number[];
    clipId: string | null;
    playing: boolean;
    observedTimeSeconds: number;
    completedCycles: number;
    previewIssues: readonly AnimationPreviewIssue[];
  };
}

export interface PresentFailure {
  ok: false;
  revision: string;
  error: {
    code:
      | 'invalid_request'
      | 'invalid_state'
      | 'not_found'
      | 'preview_unfaithful'
      | 'preview_unavailable'
      | 'render_timeout'
      | 'stale_revision';
    path?: string;
    expected?: string;
  };
}

export type PresentResult = PresentSuccess | PresentFailure;

export interface DeliverSuccess {
  ok: true;
  revision: string;
  artifact: {
    name: string;
    contentType: string;
    byteLength: number;
    target: string;
    contentHash: string;
  };
}

export interface DeliverFailure {
  ok: false;
  revision: string;
  error: {
    code:
      | 'busy'
      | 'cancelled'
      | 'invalid_state'
      | 'export_failed';
    message?: string;
    path?: string;
    expected?: string;
  };
}

export type DeliverResult = DeliverSuccess | DeliverFailure;

export interface AgentCommandPortApi {
  inspect(request?: InspectRequest): InspectResult;
  run(request: AgentRunRequest): Promise<RunResult>;
  present(request: PresentRequest): Promise<PresentResult>;
  deliver(): Promise<DeliverResult>;
}

declare global {
  interface Window {
    ashfox?: AgentCommandPortApi;
  }
}
