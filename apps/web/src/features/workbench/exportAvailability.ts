import {
  evaluateProductionReadiness,
  type AssetProject,
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
  project: AssetProject,
  report: ValidationReport,
  visualReviews: readonly VisualReviewReceipt[]
): ExportAvailabilityViewModel => {
  const document = project.document;
  const readiness = evaluateProductionReadiness(document, report);
  if (!readiness.mechanicallyReady) {
    return {
      allowed: false,
      message: readiness.firstBlockingFinding?.fix ??
        'The compiled asset needs attention before delivery.'
    };
  }
  const remaining = remainingVisualReviews(project, readiness, visualReviews);
  if (remaining.length > 0) {
    return {
      allowed: false,
      message: `The AI has ${remaining.length} visual ${remaining.length === 1 ? 'check' : 'checks'} remaining before delivery.`
    };
  }
  return {
    allowed: true,
    message: 'Canonical asset and visual review are ready for delivery.'
  };
};
