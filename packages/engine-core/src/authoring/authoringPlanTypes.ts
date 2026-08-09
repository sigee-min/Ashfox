import type {
  AuthoringAuthorityReference,
  AuthoringPartKind,
  AuthoringQualityStage,
  AuthoringSlotSymmetry,
  AuthoringSpatialRelation,
  AuthoringStructuralRole,
  AuthoringSupport
} from './authoringTypes';
import type { AuthoringSpan } from './authoringSpanTypes';

export type AuthoringSlotState =
  | 'planned'
  | 'complete'
  | 'missing'
  | 'invalid';

/**
 * Closed diagnostic vocabulary emitted by the canonical authoring plan.
 *
 * Production readiness deliberately maps every member one-to-one so a new
 * invariant cannot silently degrade into a generic "slot incomplete" error.
 */
export type AuthoringPlanIssueCode =
  | 'authoring.plan.profile_missing'
  | 'authoring.plan.profile_invalid'
  | 'authoring.plan.routing_stale'
  | 'authoring.plan.compatibility_failed'
  | 'authoring.plan.slot_incomplete'
  | 'authoring.plan.attachment_incomplete'
  | 'authoring.plan.slot_kind_invalid'
  | 'authoring.plan.slot_hierarchy_invalid'
  | 'authoring.plan.slot_spatial_invalid'
  | 'authoring.plan.slot_facing_invalid'
  | 'authoring.plan.quality_stage_invalid'
  | 'authoring.plan.symmetry_centered_invalid'
  | 'authoring.plan.symmetry_pair_invalid'
  | 'authoring.plan.support_evaluation_unavailable'
  | 'authoring.plan.support_grounding_intent_invalid'
  | 'authoring.plan.support_grounding_missing'
  | 'authoring.plan.support_part_unowned'
  | 'authoring.plan.support_part_duplicated'
  | 'authoring.plan.support_part_missing'
  | 'authoring.plan.support_hierarchy_invalid'
  | 'authoring.plan.support_sole_orientation_invalid'
  | 'authoring.plan.support_ground_contact_invalid'
  | 'authoring.plan.support_pair_reflection_invalid'
  | 'authoring.plan.support_toe_direction_invalid'
  | 'authoring.plan.support_claw_direction_invalid'
  | 'authoring.plan.span_evaluation_unavailable'
  | 'authoring.plan.span_part_missing'
  | 'authoring.plan.span_part_kind_invalid'
  | 'authoring.plan.span_root_parent_invalid'
  | 'authoring.plan.span_hierarchy_invalid'
  | 'authoring.plan.span_spar_attachment_invalid'
  | 'authoring.plan.span_spar_extension_invalid'
  | 'authoring.plan.span_membrane_envelope_invalid'
  | 'authoring.plan.span_membrane_boundary_invalid'
  | 'authoring.plan.span_cross_plane_invalid'
  | 'authoring.plan.span_ground_contact_invalid'
  | 'authoring.plan.span_pair_reflection_invalid'
  | 'authoring.plan.rest_pose_incomplete'
  | 'authoring.plan.rest_pose_evaluation_unavailable'
  | 'authoring.plan.rest_pose_support_invalid'
  | 'authoring.plan.rest_pose_ground_contact_invalid'
  | 'authoring.plan.rest_pose_clearance_invalid'
  | 'authoring.plan.rest_pose_hierarchy_invalid'
  | 'authoring.plan.rest_pose_descent_invalid'
  | 'authoring.plan.rest_pose_balance_invalid'
  | 'authoring.plan.intent_coverage_incomplete'
  | 'authoring.plan.track_stage_incomplete'
  | 'authoring.plan.face_mode_invalid'
  | 'authoring.plan.face_host_incomplete'
  | 'authoring.plan.face_component_incomplete'
  | 'authoring.plan.face_eye_unreadable'
  | 'authoring.plan.face_eye_visibility_invalid'
  | 'authoring.plan.face_eye_gaze_invalid'
  | 'authoring.plan.part_unassigned'
  | 'authoring.plan.motion_clip_missing'
  | 'authoring.plan.motion_role_invalid'
  | 'authoring.plan.motion_idle_rest_invalid'
  | 'authoring.plan.motion_static';

export interface AuthoringSlotStatus {
  slotId: string;
  label: string;
  authority: AuthoringAuthorityReference;
  authorityType: 'archetype' | 'specialist';
  required: boolean;
  structuralRole: AuthoringStructuralRole | null;
  qualityStage: AuthoringQualityStage;
  acceptedPartKinds: readonly AuthoringPartKind[];
  minParts: number;
  maxParts: number;
  parentSlotIds: readonly string[];
  spatialRelations: readonly AuthoringSpatialRelation[];
  facing: 'forward' | null;
  symmetry: AuthoringSlotSymmetry | null;
  support: AuthoringSupport | null;
  span: AuthoringSpan | null;
  attachmentPortId: string | null;
  hostSlotId: string | null;
  partIds: readonly string[];
  presentPartIds: readonly string[];
  missingPartIds: readonly string[];
  invalidKindPartIds: readonly string[];
  invalidHierarchyPartIds: readonly string[];
  invalidSpatialPartIds: readonly string[];
  invalidFacingPartIds: readonly string[];
  state: AuthoringSlotState;
  instruction: string;
}

export interface AuthoringPlanIssue {
  code: AuthoringPlanIssueCode;
  path: string;
  message: string;
  expected: string;
  authority?: AuthoringAuthorityReference;
  partIds?: readonly string[];
  clipIds?: readonly string[];
}
