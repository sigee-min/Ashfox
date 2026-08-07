import { evaluateAuthoringPlan } from '../authoring/authoringPlan';
import type { ProjectDocument } from '../model';
import type {
  ProductionReadinessCode,
  ProductionReadinessFinding
} from './types';

export interface AuthoringReadiness {
  findings: readonly ProductionReadinessFinding[];
}

const productionCode = (
  code: `authoring.plan.${string}`
): ProductionReadinessCode => {
  switch (code) {
    case 'authoring.plan.profile_missing':
      return 'production.authoring_profile_missing';
    case 'authoring.plan.profile_invalid':
      return 'production.authoring_profile_invalid';
    case 'authoring.plan.routing_stale':
      return 'production.authoring_routing_stale';
    case 'authoring.plan.compatibility_failed':
      return 'production.authoring_compatibility_invalid';
    case 'authoring.plan.attachment_incomplete':
      return 'production.authoring_attachment_incomplete';
    case 'authoring.plan.slot_kind_invalid':
      return 'production.authoring_slot_kind_invalid';
    case 'authoring.plan.slot_hierarchy_invalid':
      return 'production.authoring_slot_hierarchy_invalid';
    case 'authoring.plan.slot_spatial_invalid':
      return 'production.authoring_slot_spatial_invalid';
    case 'authoring.plan.slot_facing_invalid':
      return 'production.authoring_slot_facing_invalid';
    case 'authoring.plan.quality_stage_invalid':
      return 'production.authoring_quality_stage_invalid';
    case 'authoring.plan.intent_coverage_incomplete':
      return 'production.authoring_intent_coverage_incomplete';
    case 'authoring.plan.compact_stage_incomplete':
      return 'production.authoring_compact_stage_incomplete';
    case 'authoring.plan.showcase_stage_incomplete':
      return 'production.authoring_showcase_stage_incomplete';
    case 'authoring.plan.face_host_incomplete':
      return 'production.authoring_face_host_incomplete';
    case 'authoring.plan.face_component_incomplete':
      return 'production.authoring_face_component_incomplete';
    case 'authoring.plan.face_eye_unreadable':
      return 'production.authoring_face_eye_unreadable';
    case 'authoring.plan.face_eye_visibility_invalid':
      return 'production.authoring_face_eye_visibility_invalid';
    case 'authoring.plan.part_unassigned':
      return 'production.authoring_part_unassigned';
    case 'authoring.plan.motion_clip_missing':
      return 'production.authoring_motion_clip_missing';
    case 'authoring.plan.motion_role_invalid':
      return 'production.authoring_motion_role_invalid';
    case 'authoring.plan.motion_static':
      return 'production.authoring_motion_static';
    default:
      return 'production.authoring_slot_incomplete';
  }
};

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
      code: productionCode(issue.code),
      severity: 'error',
      message: issue.message,
      path: issue.path,
      ...(issue.partIds ? { entityIds: issue.partIds } : {}),
      ...(issue.clipIds ? { clipIds: issue.clipIds } : {}),
      fix: issue.expected
    }))
  };
};
