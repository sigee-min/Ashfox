import {
  useCallback,
  useEffect,
  useState
} from 'react';

import {
  type AssetProject,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from '../../../application/review';
import type {
  StorageStatus
} from '../persistence/project';
import {
  presentCreationStatus,
  type CreationStatusViewModel
} from '../presentation/status';
import {
  presentExportAvailability,
  type ExportAvailabilityViewModel
} from '../exportAvailability';
import {
  CANDIDATE_PREVIEW_TTL_MS,
  candidatePreviewFor
} from '../../agent/candidatePreview';

interface UseAgentAssetPresentationInput {
  readonly project: AssetProject;
  readonly report: ValidationReport;
  readonly visualReviews: readonly VisualReviewReceipt[];
  readonly storageStatus: StorageStatus;
}

export interface AgentAssetPresentationController {
  readonly viewportDocument: Readonly<ProjectDocument>;
  readonly status: CreationStatusViewModel;
  readonly exportAvailability: ExportAvailabilityViewModel;
  readonly onCandidatePreview: (token: string | null) => void;
}

export const useAgentAssetPresentation = ({
  project,
  report,
  visualReviews,
  storageStatus
}: UseAgentAssetPresentationInput): AgentAssetPresentationController => {
  const document = project.document;
  const [candidateToken, setCandidateToken] = useState<string | null>(null);
  const candidateDocument = candidateToken === null
    ? null
    : candidatePreviewFor(project, candidateToken)?.document ?? null;

  const onCandidatePreview = useCallback((token: string | null): void => {
    if (token === null || candidatePreviewFor(project, token) === null) {
      setCandidateToken(null);
      return;
    }
    setCandidateToken(token);
  }, [project]);

  useEffect(() => {
    setCandidateToken(null);
  }, [project.id, project.revision]);

  useEffect(() => {
    if (candidateToken === null) return;
    const timeout = window.setTimeout(() => {
      setCandidateToken(null);
    }, CANDIDATE_PREVIEW_TTL_MS);
    return () => window.clearTimeout(timeout);
  }, [candidateToken]);

  return {
    viewportDocument: candidateDocument ?? document,
    status: presentCreationStatus(
      project,
      report,
      visualReviews,
      storageStatus
    ),
    exportAvailability: presentExportAvailability(
      project,
      report,
      visualReviews
    ),
    onCandidatePreview
  };
};
