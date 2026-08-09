import type { IntentProgramModule } from '../types';

export interface IntentProgramConstraintIssue {
  readonly code: string;
  readonly message: string;
  /** Canonical IR path resolved through the parser-owned source map. */
  readonly path: string;
}

/** Counters make the resolver's bounded graph/index work regression-testable. */
export interface IntentProgramConstraintMetrics {
  readonly moduleCount: number;
  readonly surfaceCount: number;
  readonly shapeCount: number;
  readonly markingCount: number;
  readonly graphEdges: number;
  readonly heapPushes: number;
  readonly heapPops: number;
  readonly heapComparisons: number;
  readonly surfaceOrderComparisons: number;
  readonly supportOrderComparisons: number;
  readonly attachmentConflictChecks: number;
  readonly targetChecks: number;
}

export interface IntentProgramConstraintInspection {
  readonly issues: readonly IntentProgramConstraintIssue[];
  /** Parent-before-child, lexical ID order among simultaneously ready nodes. */
  readonly bodyOrder: readonly IntentProgramModule[];
  readonly metrics: IntentProgramConstraintMetrics;
}

export interface IntentProgramConstraintReporter {
  reportPath(code: string, message: string, path: string): void;
  hasErrors(): boolean;
}
