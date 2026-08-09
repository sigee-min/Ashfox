import type { ProjectDocument } from '../../../model';
import type { CompiledPartState } from '../../../modeling/invariants';
import type { CellKey, LatticePoint } from '../../../modeling/contract';
import type { ProjectSpatialFrame } from '../../../project/frame';
import type {
  AuthoringPlanIssue,
  AuthoringPlanIssueCode
} from '../../plan/contract';
import type { AuthoringSupport } from '../../contract';

export type SupportQualityPoint = readonly [number, number, number];

export type SupportQualityState =
  | 'not-applicable'
  | 'incomplete'
  | 'invalid'
  | 'complete';

export type SupportQualityIssueCode = Extract<
  AuthoringPlanIssueCode,
  `authoring.plan.support_${string}`
>;

export interface SupportQualityIssue extends AuthoringPlanIssue {
  code: SupportQualityIssueCode;
}

export interface SupportQualityStatus {
  slotId: string;
  supportKind: AuthoringSupport['kind'];
  contact: 'grounded' | 'free' | null;
  state: SupportQualityState;
  referencedPartIds: readonly string[];
  missingPartIds: readonly string[];
  groundContactCellCount: number;
  downwardExposedSoleCellCount: number;
  toeForwardMarginCells: number | null;
  clawForwardMarginCells: number | null;
  issueCodes: readonly SupportQualityIssueCode[];
}

export interface SupportQualityEvaluation {
  statuses: readonly SupportQualityStatus[];
  issues: readonly SupportQualityIssue[];
  /** Existing geometry that violates its declared support contract. */
  violations: readonly SupportQualityIssue[];
  ready: boolean;
}

export interface SupportEvaluationContext {
  document: ProjectDocument;
  parts: ReadonlyMap<string, CompiledPartState>;
  allCells: ReadonlySet<CellKey>;
  frame: ProjectSpatialFrame;
  forward: LatticePoint;
}

export interface MutableSupportEvaluation {
  issues: SupportQualityIssue[];
  violations: SupportQualityIssue[];
}

export interface SupportRegionMetrics {
  centroid: SupportQualityPoint;
  maximumForward: number;
}
