import type {
  ProductionReadinessReport,
  ProjectDocument,
  ValidationReport
} from '@ashfox/engine-core';

import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../../../application/projectIdentity';
import {
  rejectedVisualReviewsForRevision,
  visualReviewPlanItem,
  type VisualReviewReceipt
} from '../../../application/review';
import {
  remainingVisualReviews,
  visualReviewKey
} from '../visualReviewPlan';
import {
  classifyWorkflowFindings,
  isBlockingFinding,
  type ClassifiedWorkflowFindings
} from './finding';
import {
  deriveWorkflowActions,
  fallbackWorkflowFix
} from './actions';
import type {
  InspectWorkflowBlocker,
  InspectWorkflowGuidance,
  InspectWorkflowStage,
  ReadinessFinding
} from './inspectWorkflowTypes';

const VISUAL_REVIEW_RESPONSE_LIMIT = 6;

interface WorkflowPosition {
  stage: InspectWorkflowStage;
  blocker: ReadinessFinding | null;
}

const workflowPosition = (
  findings: ClassifiedWorkflowFindings,
  readiness: ProductionReadinessReport,
  hasRejectedReview: boolean,
  remainingReviewCount: number
): WorkflowPosition => {
  if (findings.startup) {
    return { stage: 'start', blocker: findings.startup };
  }
  if (findings.intent) {
    return { stage: 'plan', blocker: findings.intent };
  }
  if (findings.geometry) {
    return { stage: 'model', blocker: findings.geometry };
  }
  if (findings.authoring) {
    return { stage: 'model', blocker: findings.authoring };
  }
  if (findings.animation) {
    return { stage: 'animate', blocker: findings.animation };
  }
  if (!readiness.mechanicallyReady) {
    return {
      stage: 'model',
      blocker: readiness.firstBlockingFinding
    };
  }
  if (hasRejectedReview || remainingReviewCount > 0) {
    return { stage: 'review', blocker: null };
  }
  return { stage: 'deliver', blocker: null };
};

export const deriveInspectWorkflow = (
  document: ProjectDocument,
  report: ValidationReport,
  readiness: ProductionReadinessReport,
  visualReviews: readonly VisualReviewReceipt[] = []
): InspectWorkflowGuidance => {
  if (document.id === WORKBENCH_PLACEHOLDER_PROJECT_ID) {
    const { nextActions } = deriveWorkflowActions(
      document,
      'start',
      null,
      null
    );
    return {
      stage: 'start',
      blocker: {
        code: 'workflow.project_not_initialized',
        path: 'id',
        fix: 'Create the requested project, then inspect again.'
      },
      nextActions,
      remainingVisualReviews: [],
      remainingVisualReviewCount: 0,
      visualReviewsTruncated: false
    };
  }

  const findings: readonly ReadinessFinding[] = [
    ...report.findings.filter(isBlockingFinding),
    ...readiness.findings
  ];
  const classified = classifyWorkflowFindings(findings);
  const remaining = remainingVisualReviews(
    document,
    readiness,
    visualReviews
  );
  const rejected = rejectedVisualReviewsForRevision(
    visualReviews,
    document.id,
    document.revision
  )[0] ?? null;
  const { stage, blocker } = workflowPosition(
    classified,
    readiness,
    rejected !== null,
    remaining.length
  );
  const { exactOperation, nextActions } = deriveWorkflowActions(
    document,
    stage,
    blocker,
    rejected
  );
  const workflowBlocker: InspectWorkflowBlocker | null = rejected
    ? {
        code: 'review.rejected',
        path: `review.${visualReviewKey(visualReviewPlanItem(rejected))}`,
        fix:
          `Revise the rejected visual issues: ${rejected.decision.issues.join(', ')}.`
      }
    : blocker
      ? {
          code: blocker.code,
          path: blocker.path,
          fix:
            exactOperation
              ? fallbackWorkflowFix(stage, nextActions)
              : blocker.fix ??
                fallbackWorkflowFix(stage, nextActions)
        }
      : null;

  return {
    stage,
    blocker: workflowBlocker,
    nextActions,
    remainingVisualReviews: remaining
      .slice(0, VISUAL_REVIEW_RESPONSE_LIMIT)
      .map(visualReviewKey),
    remainingVisualReviewCount: remaining.length,
    visualReviewsTruncated:
      remaining.length > VISUAL_REVIEW_RESPONSE_LIMIT
  };
};
