import assert from 'node:assert/strict';

import {
  AUTHORING_SLOT_SYMMETRY_KINDS,
  evaluateSupportQuality,
  evaluateSymmetryQuality,
  type AuthoringPlanIssueCode,
  type ProductionReadinessCode,
  type SupportQualityEvaluation,
  type SymmetryQualityEvaluation
} from '../src';
import {
  AUTHORING_PRODUCTION_READINESS_CODE_BY_ISSUE,
  authoringProductionReadinessCode
} from '../src/productionReadiness/authoringReadiness';

const invariantMappings = {
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
  'authoring.plan.face_mode_invalid':
    'production.authoring_face_mode_invalid',
  'authoring.plan.face_eye_gaze_invalid':
    'production.authoring_face_eye_gaze_invalid'
} as const satisfies Partial<
  Record<AuthoringPlanIssueCode, ProductionReadinessCode>
>;

assert.deepEqual(AUTHORING_SLOT_SYMMETRY_KINDS, [
  'centered',
  'paired',
  'asymmetric'
]);
assert.equal(typeof evaluateSymmetryQuality, 'function');
assert.equal(typeof evaluateSupportQuality, 'function');

for (const [issueCode, readinessCode] of Object.entries(invariantMappings)) {
  assert.equal(
    authoringProductionReadinessCode(issueCode as AuthoringPlanIssueCode),
    readinessCode,
    `${issueCode} must retain its actionable identity at delivery time`
  );
}

const allReadinessCodes = Object.values(
  AUTHORING_PRODUCTION_READINESS_CODE_BY_ISSUE
);
assert.equal(
  new Set(allReadinessCodes).size,
  allReadinessCodes.length,
  'authoring readiness must never collapse distinct invariant failures'
);

// Compile-time public API assertions; runtime tests above prove the values are
// exported from the package root rather than only from private modules.
const acceptSymmetryEvaluation = (
  evaluation: SymmetryQualityEvaluation
): SymmetryQualityEvaluation => evaluation;
const acceptSupportEvaluation = (
  evaluation: SupportQualityEvaluation
): SupportQualityEvaluation => evaluation;
void acceptSymmetryEvaluation;
void acceptSupportEvaluation;
