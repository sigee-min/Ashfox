import type { ProjectDocument } from '../../../model';
import type { CompiledPartState } from '../../../modeling/invariants';
import type { ProjectSpatialFrame } from '../../../project/frame';
import type { AuthoringSpan } from '../../span/contract';

export const SPAN_QUALITY_ISSUE_CODES = [
  'authoring.plan.span_evaluation_unavailable',
  'authoring.plan.span_part_missing',
  'authoring.plan.span_part_kind_invalid',
  'authoring.plan.span_root_parent_invalid',
  'authoring.plan.span_hierarchy_invalid',
  'authoring.plan.span_spar_attachment_invalid',
  'authoring.plan.span_spar_extension_invalid',
  'authoring.plan.span_membrane_envelope_invalid',
  'authoring.plan.span_membrane_boundary_invalid',
  'authoring.plan.span_cross_plane_invalid',
  'authoring.plan.span_ground_contact_invalid',
  'authoring.plan.span_pair_reflection_invalid'
] as const;

export type SpanQualityIssueCode =
  (typeof SPAN_QUALITY_ISSUE_CODES)[number];

export interface SpanQualityIssue {
  code: SpanQualityIssueCode;
  path: string;
  message: string;
  expected: string;
  partIds?: readonly string[];
}

export type SpanQualityState =
  | 'not-applicable'
  | 'incomplete'
  | 'invalid'
  | 'complete';

export interface SpanQualityStatus {
  slotId: string;
  spanKind: AuthoringSpan['kind'];
  state: SpanQualityState;
  referencedPartIds: readonly string[];
  missingPartIds: readonly string[];
  issueCodes: readonly SpanQualityIssueCode[];
}

export interface SpanQualityEvaluation {
  statuses: readonly SpanQualityStatus[];
  issues: readonly SpanQualityIssue[];
  /** Existing geometry that violates its declared span contract. */
  violations: readonly SpanQualityIssue[];
  ready: boolean;
}

export interface MutableSpanQualityEvaluation {
  issues: SpanQualityIssue[];
  violations: SpanQualityIssue[];
}

export type SupportedSpan = Extract<
  AuthoringSpan,
  { kind: 'supported-surface' }
>;

export interface SpanStageFindings {
  readonly issues: readonly SpanQualityIssue[];
  readonly violations: readonly SpanQualityIssue[];
}

export interface SpanReferenceEvaluation extends SpanStageFindings {
  readonly referencedPartIds: readonly string[];
  readonly missingPartIds: readonly string[];
}

export interface SpanSlotEvaluation extends SpanStageFindings {
  readonly status: SpanQualityStatus;
}

export interface SpanEvaluationContext {
  document: ProjectDocument;
  parts: ReadonlyMap<string, CompiledPartState>;
  frame: ProjectSpatialFrame;
}
