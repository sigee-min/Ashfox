import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  ArtifactFile
} from '../files/artifactFile';
import type {
  FileOperationRunResult
} from '../files/useFileOperation';
import type {
  DeliverResult
} from './types';
import {
  nextVisualReview
} from './visualReviewPlan';
import type {
  VisualReviewReceipt
} from './presentationReview';

interface DeliverAgentProjectInput {
  document: ProjectDocument;
  report: ValidationReport;
  visualReviews: readonly VisualReviewReceipt[];
  currentDocument: () => ProjectDocument;
  exportTarget: () => Promise<
    FileOperationRunResult<ArtifactFile>
  >;
}

export const deliverAgentProject = async ({
  document,
  report,
  visualReviews,
  currentDocument,
  exportTarget
}: DeliverAgentProjectInput): Promise<DeliverResult> => {
  const readiness = evaluateProductionReadiness(document, report);
  if (!readiness.mechanicallyReady) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        path: readiness.firstBlockingFinding?.path ?? '$',
        expected:
          readiness.firstBlockingFinding?.fix ??
          'mechanically ready project'
      }
    };
  }

  if (nextVisualReview(document, readiness, visualReviews)) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'invalid_state',
        path: 'review',
        expected:
          'explicitly accept every revision-bound visual review'
      }
    };
  }

  const delivered = await exportTarget();
  if (!delivered.ok) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code:
          delivered.code === 'failed'
            ? 'export_failed'
            : delivered.code,
        message: delivered.message
      }
    };
  }

  const current = currentDocument();
  if (
    current.id !== document.id ||
    current.revision !== document.revision
  ) {
    return {
      ok: false,
      revision: current.revision,
      error: {
        code: 'invalid_state',
        message: 'Project changed while the artifact was being prepared.',
        path: 'revision',
        expected: document.revision
      }
    };
  }

  const artifact = delivered.result;
  if (
    !artifact ||
    artifact.projectId !== document.id ||
    artifact.sourceRevision !== document.revision
  ) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'export_failed',
        message:
          'Export did not produce an artifact for the active revision.'
      }
    };
  }

  return {
    ok: true,
    revision: document.revision,
    artifact: {
      name: artifact.name,
      contentType: artifact.contentType,
      byteLength: artifact.bytes.byteLength,
      target: artifact.target,
      contentHash: artifact.contentHash
    }
  };
};
