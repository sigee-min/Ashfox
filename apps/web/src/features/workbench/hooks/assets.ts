import { useMemo } from 'react';

import {
  intentProgramReviewDigest,
  previewIntentProgram,
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
  type CandidatePreviewState,
  type CreationStatusViewModel
} from '../presentation/status';
import {
  presentExportAvailability,
  type ExportAvailabilityViewModel
} from '../exportAvailability';

interface UseAgentAssetPresentationInput {
  readonly document: ProjectDocument;
  readonly report: ValidationReport;
  readonly visualReviews: readonly VisualReviewReceipt[];
  readonly storageStatus: StorageStatus;
}

export interface AgentAssetPresentationController {
  /** The only candidate-bearing output; it belongs exclusively to Viewport. */
  readonly viewportDocument: Readonly<ProjectDocument>;
  readonly isCandidatePreview: boolean;
  readonly status: CreationStatusViewModel;
  readonly exportAvailability: ExportAvailabilityViewModel;
}

/**
 * A staged candidate is passive visual evidence. It cannot enter persistence,
 * history, export, Agent review receipts, or any human action surface.
 */
export const useAgentAssetPresentation = ({
  document,
  report,
  visualReviews,
  storageStatus
}: UseAgentAssetPresentationInput): AgentAssetPresentationController => {
  const proposalDigest = document.intentProgramProposal
    ? intentProgramReviewDigest(document.intentProgramProposal)
    : null;
  const candidateResult = useMemo(
    () => document.intentProgramProposal
      ? previewIntentProgram(document, document.intentProgramProposal)
      : null,
    [document, proposalDigest]
  );
  const isCandidatePreview = candidateResult?.ok === true;
  const candidatePreview: CandidatePreviewState = !candidateResult
    ? 'none'
    : candidateResult.ok
      ? 'available'
      : 'failed';

  return {
    viewportDocument: isCandidatePreview
      ? candidateResult.preview.candidateDocument
      : document,
    isCandidatePreview,
    status: presentCreationStatus(
      document,
      report,
      visualReviews,
      storageStatus,
      candidatePreview
    ),
    exportAvailability: presentExportAvailability(
      document,
      report,
      visualReviews
    )
  };
};
