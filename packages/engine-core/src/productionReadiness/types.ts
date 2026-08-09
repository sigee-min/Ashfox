import type { InvariantFinding } from '../validation';

export type ProductionReadinessCode =
  | 'production.geometry_missing'
  | 'production.texture_coverage_incomplete'
  | 'production.idle_missing'
  | 'production.idle_channels_missing'
  | 'production.idle_loop_invalid'
  | 'production.animation_loop_invalid'
  | 'production.animation_preview_unfaithful'
  | 'production.intent_missing'
  | 'production.intent_invalid'
  | 'production.intent_confirmation_pending'
  | 'production.intent_grounding_mismatch'
  | 'production.intent_grounding_unstable'
  | 'production.intent_grounding_unverifiable'
  | 'production.intent_evaluation_unavailable'
  | 'production.authoring_profile_missing'
  | 'production.authoring_profile_invalid'
  | 'production.authoring_routing_stale'
  | 'production.authoring_compatibility_invalid'
  | 'production.authoring_slot_incomplete'
  | 'production.authoring_attachment_incomplete'
  | 'production.authoring_slot_kind_invalid'
  | 'production.authoring_slot_hierarchy_invalid'
  | 'production.authoring_slot_spatial_invalid'
  | 'production.authoring_slot_facing_invalid'
  | 'production.authoring_quality_stage_invalid'
  | 'production.authoring_symmetry_centered_invalid'
  | 'production.authoring_symmetry_pair_invalid'
  | 'production.authoring_support_evaluation_unavailable'
  | 'production.authoring_support_grounding_intent_invalid'
  | 'production.authoring_support_grounding_missing'
  | 'production.authoring_support_part_unowned'
  | 'production.authoring_support_part_duplicated'
  | 'production.authoring_support_part_missing'
  | 'production.authoring_support_hierarchy_invalid'
  | 'production.authoring_support_sole_orientation_invalid'
  | 'production.authoring_support_ground_contact_invalid'
  | 'production.authoring_support_wheel_primitive_invalid'
  | 'production.authoring_support_pair_reflection_invalid'
  | 'production.authoring_support_toe_direction_invalid'
  | 'production.authoring_support_claw_direction_invalid'
  | 'production.authoring_span_evaluation_unavailable'
  | 'production.authoring_span_part_missing'
  | 'production.authoring_span_part_kind_invalid'
  | 'production.authoring_span_root_parent_invalid'
  | 'production.authoring_span_hierarchy_invalid'
  | 'production.authoring_span_spar_attachment_invalid'
  | 'production.authoring_span_spar_extension_invalid'
  | 'production.authoring_span_membrane_envelope_invalid'
  | 'production.authoring_span_membrane_boundary_invalid'
  | 'production.authoring_span_cross_plane_invalid'
  | 'production.authoring_span_ground_contact_invalid'
  | 'production.authoring_span_pair_reflection_invalid'
  | 'production.authoring_rest_pose_incomplete'
  | 'production.authoring_rest_pose_evaluation_unavailable'
  | 'production.authoring_rest_pose_support_invalid'
  | 'production.authoring_rest_pose_ground_contact_invalid'
  | 'production.authoring_rest_pose_clearance_invalid'
  | 'production.authoring_rest_pose_hierarchy_invalid'
  | 'production.authoring_rest_pose_descent_invalid'
  | 'production.authoring_rest_pose_balance_invalid'
  | 'production.authoring_intent_coverage_incomplete'
  | 'production.authoring_track_stage_incomplete'
  | 'production.authoring_face_mode_invalid'
  | 'production.authoring_face_host_incomplete'
  | 'production.authoring_face_component_incomplete'
  | 'production.authoring_face_eye_unreadable'
  | 'production.authoring_face_eye_visibility_invalid'
  | 'production.authoring_face_eye_gaze_invalid'
  | 'production.authoring_part_unassigned'
  | 'production.authoring_motion_clip_missing'
  | 'production.authoring_motion_role_invalid'
  | 'production.authoring_motion_idle_rest_invalid'
  | 'production.authoring_motion_static';

export interface ProductionReadinessFinding {
  code: ProductionReadinessCode;
  severity: 'error';
  message: string;
  path: string;
  entityIds?: readonly string[];
  assetIds?: readonly string[];
  clipIds?: readonly string[];
  idsTruncated?: boolean;
  fix: string;
}

export interface ProductionReadinessCounts {
  structuralErrors: number;
  structuralWarnings: number;
  visibleGeometry: number;
  enabledVisibleFaces: number;
  texturedVisibleFaces: number;
  untexturedVisibleFaces: number;
  idleClips: number;
  idleChannels: number;
  animationClips: number;
  previewableAnimationClips: number;
  intentPresent: boolean;
  features: number;
  unverifiableGeometry: number;
  groundSupportCells: number;
  projectedFootprintCells: number;
  uniformCenterOfMassSupported: boolean | null;
}

export interface ProductionReadinessReport {
  structurallyValid: boolean;
  mechanicallyReady: boolean;
  semanticReviewRequired: true;
  counts: ProductionReadinessCounts;
  findings: readonly ProductionReadinessFinding[];
  firstBlockingFinding:
    | InvariantFinding
    | ProductionReadinessFinding
    | null;
}
