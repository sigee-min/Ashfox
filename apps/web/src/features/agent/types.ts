import { COMMAND_RECEIPT_SCHEMA_VERSION } from '@ashfox/engine-core';
import type {
  CommandSource,
  ExportAdaptationReceipt,
  InvariantFinding,
  MinecraftGameVersion,
  ProjectCommandOperation
} from '@ashfox/engine-core';
import {
  VISUAL_REVIEW_CAMERAS,
  VISUAL_REVIEW_ISSUES,
  VISUAL_REVIEW_MILESTONES,
  type PresentedReviewCheck,
  type VisualReviewCamera,
  type VisualReviewIssue,
  type VisualReviewMilestone,
  type VisualReviewObservation
} from '../../application/visualReviewContract';
import type {
  CameraMode
} from '../../rendering/cameraPresets';

export {
  VISUAL_REVIEW_CAMERAS,
  VISUAL_REVIEW_ISSUES,
  VISUAL_REVIEW_MILESTONES
};
export type {
  PresentedReviewCheck,
  VisualReviewCamera,
  VisualReviewIssue,
  VisualReviewMilestone
};

export type InspectRequest =
  | { kind: 'command'; name: string }
  | { kind: 'catalog'; cursor?: string; limit?: number }
  | { kind: 'parts'; ids: readonly string[] }
  | { kind: 'entity'; ids: readonly string[] }
  | { kind: 'texture'; ids: readonly string[] }
  | {
      kind: 'clip';
      id: string;
      trackId?: string;
      cursor?: string;
      limit?: number;
    }
  | { kind: 'activity'; cursor?: string; limit?: number }
  | { kind: 'target' }
  | { kind: 'authoring'; id?: string }
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
  schemaVersion: typeof COMMAND_RECEIPT_SCHEMA_VERSION;
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
  requestId: string;
  operations: readonly ProjectCommandOperation[];
}

export type PresentRequest =
  | {
      review: 'next';
    }
  | {
      review: 'preview';
      milestone?: VisualReviewMilestone;
      camera?: VisualReviewCamera;
    }
  | {
      review: 'accept';
      frameNonce: number;
      checkIds: readonly string[];
    }
  | {
      review: 'reject';
      frameNonce: number;
      issues: readonly VisualReviewIssue[];
      failedCheckIds: readonly string[];
    };

interface ViewPresentationRequestBase {
  mode: 'frame' | 'cycle';
  camera: CameraMode;
  clipId: string | null;
  timeSeconds: number;
  reviewChecks: readonly PresentedReviewCheck[];
}

export type ViewPresentationRequest =
  | (ViewPresentationRequestBase & {
      review: 'next';
      purpose: 'delivery';
      milestone: null;
    })
  | (ViewPresentationRequestBase & {
      review: 'preview';
      purpose: 'preview';
      milestone: VisualReviewMilestone | null;
    });

export type VisualReviewDecisionRequest = Extract<
  PresentRequest,
  { review: 'accept' | 'reject' }
>;

export type PresentSuccess = VisualReviewObservation;

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
    gameVersion: MinecraftGameVersion | null;
    contentHash: string;
    adaptationCount: number;
    adaptations: ExportAdaptationReceipt;
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

export type AgentCaptureRequest =
  | { kind: 'result' }
  | { kind: 'animation'; clipId?: string }
  | { kind: 'build' };

export interface CaptureArtifactMetadata {
  kind: AgentCaptureRequest['kind'];
  name: string;
  contentType: string;
  byteLength: number;
  contentHash: string;
  width?: number;
  height?: number;
  frameCount?: number;
  eventCount?: number;
  fps?: number;
}

export interface CaptureSuccess {
  ok: true;
  revision: string;
  artifact: CaptureArtifactMetadata;
}

export interface CaptureFailure {
  ok: false;
  revision: string;
  error: {
    code:
      | 'invalid_request'
      | 'busy'
      | 'cancelled'
      | 'invalid_state'
      | 'capture_failed'
      | 'stale_revision';
    message?: string;
    path?: string;
    expected?: string;
  };
}

export type CaptureResult = CaptureSuccess | CaptureFailure;

export interface AgentCommandPortApi {
  inspect(request?: InspectRequest): InspectResult;
  run(request: AgentRunRequest): Promise<RunResult>;
  present(request: PresentRequest): Promise<PresentResult>;
  capture(request: AgentCaptureRequest): Promise<CaptureResult>;
  deliver(): Promise<DeliverResult>;
}

declare global {
  interface Window {
    ashfox?: AgentCommandPortApi;
  }
}
