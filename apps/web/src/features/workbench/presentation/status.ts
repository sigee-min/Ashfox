import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from '../../../application/review';
import type {
  StorageStatus
} from '../persistence/project';
import { remainingVisualReviews } from '../../agent/visualReviewPlan';

export type AgentAssetState =
  | 'awaiting-prompt'
  | 'working'
  | 'reviewing'
  | 'ready'
  | 'attention';

export interface CreationStatusViewModel {
  readonly state: AgentAssetState;
  readonly label: string;
  readonly detail: string;
  readonly autosaveLabel: string;
  readonly autosaveState: 'busy' | 'saved' | 'error';
}

export type CandidatePreviewState = 'none' | 'available' | 'failed';

const autosave = (
  status: StorageStatus
): Pick<CreationStatusViewModel, 'autosaveLabel' | 'autosaveState'> => {
  switch (status) {
    case 'loading':
      return { autosaveLabel: 'Loading local project…', autosaveState: 'busy' };
    case 'saving':
      return { autosaveLabel: 'Autosaving…', autosaveState: 'busy' };
    case 'saved':
      return { autosaveLabel: 'Autosaved', autosaveState: 'saved' };
    case 'error':
      return { autosaveLabel: 'Autosave needs attention', autosaveState: 'error' };
  }
};

export const presentCreationStatus = (
  document: ProjectDocument,
  report: ValidationReport,
  visualReviews: readonly VisualReviewReceipt[],
  storageStatus: StorageStatus,
  candidatePreview: CandidatePreviewState = 'none'
): CreationStatusViewModel => {
  const saved = autosave(storageStatus);
  if (document.intentProgramProposal) {
    return candidatePreview === 'failed'
      ? {
          state: 'attention',
          label: 'AI is revising the update',
          detail: 'The current asset remains unchanged.',
          ...saved
        }
      : {
          state: 'working',
          label: 'AI is preparing an update',
          detail: candidatePreview === 'available'
            ? 'Showing a temporary preview while the AI decides whether to compile or revise.'
            : 'Validating the next asset version.',
          ...saved
        };
  }
  if (!document.intentProgram) {
    return {
      state: 'awaiting-prompt',
      label: 'Ready for your prompt',
      detail: 'Describe what you want in chat. The AI handles the build.',
      ...saved
    };
  }
  const readiness = evaluateProductionReadiness(document, report);
  if (!readiness.mechanicallyReady) {
    return {
      state: 'attention',
      label: 'AI needs to revise this asset',
      detail: readiness.firstBlockingFinding?.fix ??
        'The current compiled result needs attention.',
      ...saved
    };
  }
  const remaining = remainingVisualReviews(
    document,
    readiness,
    visualReviews
  );
  if (remaining.length > 0) {
    return {
      state: 'reviewing',
      label: 'AI is reviewing the result',
      detail: `${remaining.length} visual ${remaining.length === 1 ? 'check' : 'checks'} remaining.`,
      ...saved
    };
  }
  return {
    state: 'ready',
    label: 'Ready to export',
    detail: 'The compiled asset passed its required checks.',
    ...saved
  };
};
