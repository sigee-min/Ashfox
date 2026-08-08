import { evaluateAuthoringPlan } from '../authoring/authoringPlan';
import type { AuthoringPlanIssueCode } from '../authoring/authoringPlanTypes';
import type { ProjectDocument } from '../model';
import type {
  ProductionReadinessCode,
  ProductionReadinessFinding
} from './types';

export interface AuthoringReadiness {
  findings: readonly ProductionReadinessFinding[];
}

export const AUTHORING_PRODUCTION_READINESS_CODE_BY_ISSUE = {
  'authoring.plan.profile_missing':
    'production.authoring_profile_missing',
  'authoring.plan.profile_invalid':
    'production.authoring_profile_invalid',
  'authoring.plan.routing_stale':
    'production.authoring_routing_stale',
  'authoring.plan.compatibility_failed':
    'production.authoring_compatibility_invalid',
  'authoring.plan.slot_incomplete':
    'production.authoring_slot_incomplete',
  'authoring.plan.attachment_incomplete':
    'production.authoring_attachment_incomplete',
  'authoring.plan.slot_kind_invalid':
    'production.authoring_slot_kind_invalid',
  'authoring.plan.slot_hierarchy_invalid':
    'production.authoring_slot_hierarchy_invalid',
  'authoring.plan.slot_spatial_invalid':
    'production.authoring_slot_spatial_invalid',
  'authoring.plan.slot_facing_invalid':
    'production.authoring_slot_facing_invalid',
  'authoring.plan.quality_stage_invalid':
    'production.authoring_quality_stage_invalid',
  'authoring.plan.symmetry_centered_invalid':
    'production.authoring_symmetry_centered_invalid',
  'authoring.plan.symmetry_pair_invalid':
    'production.authoring_symmetry_pair_invalid',
  'authoring.plan.support_evaluation_unavailable':
    'production.authoring_support_evaluation_unavailable',
  'authoring.plan.support_grounding_intent_invalid':
    'production.authoring_support_grounding_intent_invalid',
  'authoring.plan.support_grounding_missing':
    'production.authoring_support_grounding_missing',
  'authoring.plan.support_part_unowned':
    'production.authoring_support_part_unowned',
  'authoring.plan.support_part_duplicated':
    'production.authoring_support_part_duplicated',
  'authoring.plan.support_part_missing':
    'production.authoring_support_part_missing',
  'authoring.plan.support_hierarchy_invalid':
    'production.authoring_support_hierarchy_invalid',
  'authoring.plan.support_sole_orientation_invalid':
    'production.authoring_support_sole_orientation_invalid',
  'authoring.plan.support_ground_contact_invalid':
    'production.authoring_support_ground_contact_invalid',
  'authoring.plan.support_pair_reflection_invalid':
    'production.authoring_support_pair_reflection_invalid',
  'authoring.plan.support_toe_direction_invalid':
    'production.authoring_support_toe_direction_invalid',
  'authoring.plan.support_claw_direction_invalid':
    'production.authoring_support_claw_direction_invalid',
  'authoring.plan.intent_coverage_incomplete':
    'production.authoring_intent_coverage_incomplete',
  'authoring.plan.track_stage_incomplete':
    'production.authoring_track_stage_incomplete',
  'authoring.plan.face_mode_invalid':
    'production.authoring_face_mode_invalid',
  'authoring.plan.face_host_incomplete':
    'production.authoring_face_host_incomplete',
  'authoring.plan.face_component_incomplete':
    'production.authoring_face_component_incomplete',
  'authoring.plan.face_eye_unreadable':
    'production.authoring_face_eye_unreadable',
  'authoring.plan.face_eye_visibility_invalid':
    'production.authoring_face_eye_visibility_invalid',
  'authoring.plan.face_eye_gaze_invalid':
    'production.authoring_face_eye_gaze_invalid',
  'authoring.plan.part_unassigned':
    'production.authoring_part_unassigned',
  'authoring.plan.motion_clip_missing':
    'production.authoring_motion_clip_missing',
  'authoring.plan.motion_role_invalid':
    'production.authoring_motion_role_invalid',
  'authoring.plan.motion_static':
    'production.authoring_motion_static'
} as const satisfies Readonly<
  Record<AuthoringPlanIssueCode, ProductionReadinessCode>
>;

export const authoringProductionReadinessCode = (
  code: AuthoringPlanIssueCode
): ProductionReadinessCode =>
  AUTHORING_PRODUCTION_READINESS_CODE_BY_ISSUE[code];

export const evaluateAuthoringReadiness = (
  document: ProjectDocument
): AuthoringReadiness => {
  const evaluation = evaluateAuthoringPlan(document);
  if (
    !evaluation.selected &&
    (document.intent?.references?.length ?? 0) === 0
  ) {
    return { findings: [] };
  }
  return {
    findings: evaluation.issues.map((issue) => ({
      code: authoringProductionReadinessCode(issue.code),
      severity: 'error',
      message: issue.message,
      path: issue.path,
      ...(issue.partIds ? { entityIds: issue.partIds } : {}),
      ...(issue.clipIds ? { clipIds: issue.clipIds } : {}),
      fix: issue.expected
    }))
  };
};
