import type {
  InvariantFinding,
  ProductionReadinessFinding,
  ProjectCommandOperation
} from '@ashfox/engine-core';

export type InspectWorkflowStage =
  | 'start'
  | 'plan'
  | 'model'
  | 'animate'
  | 'review'
  | 'deliver';

export interface InspectWorkflowBlocker {
  code: string;
  path: string;
  fix: string;
}

export type InspectWorkflowAction =
  | {
      kind: 'operation';
      operation: ProjectCommandOperation;
    }
  | {
      kind: 'command';
      name: string;
    }
  | {
      kind: 'present';
      request: { review: 'next' };
    };

export interface InspectWorkflowGuidance {
  stage: InspectWorkflowStage;
  blocker: InspectWorkflowBlocker | null;
  nextActions: readonly InspectWorkflowAction[];
  remainingVisualReviews: readonly string[];
  remainingVisualReviewCount: number;
  visualReviewsTruncated: boolean;
}

export type ReadinessFinding =
  | InvariantFinding
  | ProductionReadinessFinding;
