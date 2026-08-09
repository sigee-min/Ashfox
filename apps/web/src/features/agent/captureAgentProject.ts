import {
  evaluateProductionReadiness,
  type CommandReceipt,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type { OperationLeaseToken } from '../../application/operationLease';
import type { ArtifactFile } from '../files/artifactFile';
import { isArtifactCurrent } from '../files/artifactFile';
import type { CaptureArtifactRequest } from '../files/capture';
import type { FileOperationRunResult } from '../files/useFileOperation';
import { isGifCaptureFile } from '../capture/gifCaptureFile';
import { isResultCaptureFile } from '../capture/resultCaptureFile';
import { resolveBuildReviewClip } from '../capture/buildReviewClip';
import type {
  AgentCaptureRequest,
  CaptureResult
} from './types';
import type {
  VisualReviewReceipt
} from '../../application/review';
import { nextVisualReview } from './visualReviewPlan';
import {
  pendingIntentProgramBlock
} from './proposal';

interface CaptureAgentProjectInput {
  request: AgentCaptureRequest;
  document: ProjectDocument;
  report: ValidationReport;
  visualReviews: readonly VisualReviewReceipt[];
  buildDocuments: readonly ProjectDocument[];
  activity: readonly CommandReceipt[];
  currentDocument: () => ProjectDocument;
  capture: (
    request: CaptureArtifactRequest,
    lease: OperationLeaseToken
  ) => Promise<FileOperationRunResult<ArtifactFile>>;
  lease: OperationLeaseToken;
}

const invalidState = (
  revision: string,
  path: string,
  expected: string
): CaptureResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_state',
    path,
    expected
  }
});

const operationFailure = (
  revision: string,
  result: Extract<FileOperationRunResult<ArtifactFile>, { ok: false }>
): CaptureResult => ({
  ok: false,
  revision,
  error: {
    code:
      result.code === 'failed'
        ? 'capture_failed'
        : result.code,
    message: result.message
  }
});

const currentBuildDocuments = (
  document: ProjectDocument,
  documents: readonly ProjectDocument[]
): readonly ProjectDocument[] => {
  const sameProject = documents.filter(
    (candidate) => candidate.id === document.id
  );
  const currentIndex = sameProject.findIndex(
    (candidate) => candidate.revision === document.revision
  );
  const throughCurrent = currentIndex >= 0
    ? sameProject.slice(0, currentIndex + 1)
    : [...sameProject, document];
  const unique: ProjectDocument[] = [];
  for (const candidate of throughCurrent) {
    if (unique.at(-1)?.revision !== candidate.revision) {
      unique.push(candidate);
    }
  }
  if (unique.at(-1)?.revision !== document.revision) {
    unique.push(document);
  }
  return unique;
};

const currentBuildActivity = (
  document: ProjectDocument,
  documents: readonly ProjectDocument[],
  activity: readonly CommandReceipt[]
): readonly CommandReceipt[] => {
  const revisions = new Set(
    documents.map((candidate) => candidate.revision)
  );
  return activity.filter(
    (receipt) =>
      receipt.projectId === document.id &&
      revisions.has(receipt.revision)
  );
};

const captureRequestFor = (
  request: AgentCaptureRequest,
  document: ProjectDocument,
  buildDocuments: readonly ProjectDocument[],
  activity: readonly CommandReceipt[]
): CaptureArtifactRequest | CaptureResult => {
  if (request.kind === 'result') return request;

  if (request.kind === 'build') {
    const documents = currentBuildDocuments(document, buildDocuments);
    return {
      kind: 'build',
      documents,
      receipts: currentBuildActivity(document, documents, activity),
      environment: 'studio',
      cameraMode: 'perspective'
    };
  }

  const clip = request.clipId === undefined
    ? resolveBuildReviewClip(document)
    : document.animations[request.clipId] ?? null;
  if (!clip) {
    return request.clipId === undefined
      ? invalidState(
          document.revision,
          'animations',
          'a canonical renderable idle or review animation clip'
        )
      : {
          ok: false,
          revision: document.revision,
          error: {
            code: 'invalid_request',
            path: 'clipId',
            expected: 'an existing animation clip ID'
          }
        };
  }
  return {
    kind: 'animation',
    clipId: clip.id,
    environment: 'studio',
    cameraMode: 'perspective'
  };
};

const isCaptureResult = (
  value: CaptureArtifactRequest | CaptureResult
): value is CaptureResult => 'ok' in value;

const artifactResult = (
  document: ProjectDocument,
  artifact: ArtifactFile,
  kind: AgentCaptureRequest['kind']
): CaptureResult => {
  const dimensions =
    isGifCaptureFile(artifact) || isResultCaptureFile(artifact)
      ? {
          width: artifact.width,
          height: artifact.height
        }
      : {};
  const timeline = isGifCaptureFile(artifact)
    ? {
        frameCount: artifact.frameCount,
        eventCount: artifact.eventCount,
        fps: artifact.fps
      }
    : {};
  return {
    ok: true,
    revision: document.revision,
    artifact: {
      kind,
      name: artifact.name,
      contentType: artifact.contentType,
      byteLength: artifact.bytes.byteLength,
      contentHash: artifact.contentHash,
      ...dimensions,
      ...timeline
    }
  };
};

export const captureAgentProject = async ({
  request,
  document,
  report,
  visualReviews,
  buildDocuments,
  activity,
  currentDocument,
  capture,
  lease
}: CaptureAgentProjectInput): Promise<CaptureResult> => {
  const proposalBlock = pendingIntentProgramBlock(document);
  if (proposalBlock) {
    return invalidState(
      document.revision,
      proposalBlock.path,
      proposalBlock.expected
    );
  }
  const readiness = evaluateProductionReadiness(document, report);
  if (!readiness.mechanicallyReady) {
    return invalidState(
      document.revision,
      readiness.firstBlockingFinding?.path ?? '$',
      readiness.firstBlockingFinding?.fix ?? 'mechanically ready project'
    );
  }

  if (nextVisualReview(document, readiness, visualReviews)) {
    return invalidState(
      document.revision,
      'review',
      'explicitly accept every revision-bound visual review'
    );
  }

  const preparedRequest = captureRequestFor(
    request,
    document,
    buildDocuments,
    activity
  );
  if (isCaptureResult(preparedRequest)) return preparedRequest;

  const result = await capture(preparedRequest, lease);
  if (!result.ok) return operationFailure(document.revision, result);

  const current = currentDocument();
  if (
    current.id !== document.id ||
    current.revision !== document.revision
  ) {
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
    artifact.kind !== request.kind ||
    !isArtifactCurrent(document, artifact)
  ) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'capture_failed',
        message:
          'Capture did not produce an artifact for the active revision.'
      }
    };
  }

  return artifactResult(document, artifact, request.kind);
};
