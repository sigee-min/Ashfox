import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from '../../application/review';
import { remainingVisualReviews } from '../agent/visualReviewPlan';

export interface ExportAvailabilityViewModel {
  readonly allowed: boolean;
  readonly message: string;
}

export const presentExportAvailability = (
  document: ProjectDocument,
  report: ValidationReport,
  visualReviews: readonly VisualReviewReceipt[]
): ExportAvailabilityViewModel => {
  if (document.intentProgramProposal) {
    return {
      allowed: false,
      message: 'The AI is compiling or revising the staged update. Export will unlock when it finishes.'
    };
  }
  if (!document.intentProgram) {
    return {
      allowed: false,
      message: 'Describe the asset in chat. The AI will build and review it before export.'
    };
  }
  const readiness = evaluateProductionReadiness(document, report);
  if (!readiness.mechanicallyReady) {
    return {
      allowed: false,
      message: readiness.firstBlockingFinding?.fix ??
        'The compiled asset needs attention before export.'
    };
  }
  const remaining = remainingVisualReviews(document, readiness, visualReviews);
  if (remaining.length > 0) {
    return {
      allowed: false,
      message: `The AI has ${remaining.length} visual ${remaining.length === 1 ? 'check' : 'checks'} remaining before export.`
    };
  }
  return {
    allowed: true,
    message: 'Canonical asset and visual review are ready for delivery.'
  };
};
