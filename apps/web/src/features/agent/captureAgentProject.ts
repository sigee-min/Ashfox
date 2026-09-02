import {
  evaluateProductionReadiness,
  type AssetProject,
  type ValidationReport
} from '@ashfox/engine-core';

import type { OperationLeaseToken } from '../../application/operationLease';
import type { VisualReviewReceipt } from '../../application/review';
import { isGifCaptureFile } from '../capture/gifCaptureFile';
import type { ArtifactFile } from '../files/artifactFile';
import { isArtifactCurrent } from '../files/artifactFile';
import type { CaptureArtifactRequest } from '../files/capture';
import type { FileOperationRunResult } from '../files/useFileOperation';
import type {
  AgentCaptureRequest,
  CaptureResult
} from './types';
import { nextVisualReview } from './visualReviewPlan';

interface CaptureAgentProjectInput {
  readonly request: AgentCaptureRequest;
  readonly project: AssetProject;
  readonly report: ValidationReport;
  readonly visualReviews: readonly VisualReviewReceipt[];
  readonly currentProject: () => AssetProject;
  readonly capture: (
    request: CaptureArtifactRequest,
    lease: OperationLeaseToken
  ) => Promise<FileOperationRunResult<ArtifactFile>>;
  readonly lease: OperationLeaseToken;
}

const invalidState = (
  revision: string,
  path: string,
  expected: string
): CaptureResult => ({
  ok: false,
  revision,
  error: { code: 'invalid_state', path, expected }
});

const operationFailure = (
  revision: string,
  result: Extract<FileOperationRunResult<ArtifactFile>, { ok: false }>
): CaptureResult => ({
  ok: false,
  revision,
  error: {
    code: result.code === 'failed' ? 'capture_failed' : result.code,
    message: result.message
  }
});

export const captureAgentProject = async ({
  request,
  project,
  report,
  visualReviews,
  currentProject,
  capture,
  lease
}: CaptureAgentProjectInput): Promise<CaptureResult> => {
  const document = project.document;
  const readiness = evaluateProductionReadiness(document, report);
  if (!readiness.mechanicallyReady) {
    return invalidState(
      document.revision,
      readiness.firstBlockingFinding?.path ?? '$',
      readiness.firstBlockingFinding?.fix ?? 'mechanically ready project'
    );
  }
  if (nextVisualReview(project, readiness, visualReviews)) {
    return invalidState(
      document.revision,
      'review',
      'explicitly accept every revision-bound visual review'
    );
  }
  const result = await capture({
    kind: request.kind,
    environment: 'studio',
    cameraMode: 'perspective'
  }, lease);
  if (!result.ok) return operationFailure(document.revision, result);

  const current = currentProject();
  if (current.id !== project.id ||
    current.revision !== project.revision ||
    current.build.productHash !== project.build.productHash ||
    current.build.workspaceHash !== project.build.workspaceHash ||
    current.entry.packageName !== project.entry.packageName ||
    current.entry.entryName !== project.entry.entryName) {
    return {
      ok: false,
      revision: current.revision,
      error: {
        code: 'stale_revision',
        path: 'revision',
        expected: document.revision
      }
    };
  }
  const artifact = result.result;
  if (
    artifact === null ||
    !isGifCaptureFile(artifact) ||
    !isArtifactCurrent(project, artifact)
  ) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'capture_failed',
        message: 'Build replay did not produce the active revision artifact.'
      }
    };
  }
  return {
    ok: true,
    revision: document.revision,
    artifact: {
      kind: 'build',
      name: artifact.name,
      contentType: artifact.contentType,
      byteLength: artifact.bytes.byteLength,
      contentHash: artifact.contentHash,
      width: artifact.width,
      height: artifact.height,
      frameCount: artifact.frameCount,
      eventCount: artifact.eventCount,
      fps: artifact.fps
    }
  };
};
