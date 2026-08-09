import assert from 'node:assert/strict';

import { evaluateAuthoringPlan } from '../../../src/authoring/plan';
import type { AuthoringProfile } from '../../../src/authoring/contract';
import { evaluateRestPoseQuality } from '../../../src/authoring/quality/rest';
import { materializeIntentProgram } from '../../../src/compiler/program/materialize';
import { createProjectDocument } from '../../../src/project/create';
import { parseIntentProgram } from '../../../src/project/program';
import { intentProgramSource } from '../../program/source';

const source = intentProgramSource({
  name: 'Rest Quality Fixture',
  track: 'essential',
  domain: 'organism',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'feet', contacts: ['legs'] },
  body: [{
    id: 'torso', kind: 'core', cardinality: 'single'
  }, {
    id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'torso',
    anchor: 'sides', growth: 'down', lane: 'center'
  }],
  face: { kind: 'none' },
  idle: { mode: 'still' },
  appearance: {
    palette: 'natural',
    texture: {
      kind: 'mottle', scale: 'broad', density: 'balanced', contrast: 'subtle'
    },
    seed: { kind: 'auto' },
    markings: []
  }
});

const parsed = parseIntentProgram(source);
assert.deepEqual(parsed.diagnostics, []);
assert.ok(parsed.hash);
const materialized = materializeIntentProgram(createProjectDocument({
  id: 'rest-quality-fixture',
  name: 'rest quality fixture',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
}), { source, hash: parsed.hash });
if (!materialized.ok) throw new Error(materialized.error.message);

const plan = evaluateAuthoringPlan(materialized.document);
assert.ok(plan.profile);
const profile = plan.profile;

const deepFreeze = (value: unknown): void => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  Object.freeze(value);
};

deepFreeze(materialized.document);
deepFreeze(profile);
const snapshot = JSON.stringify({ document: materialized.document, profile });
const first = evaluateRestPoseQuality(materialized.document, profile);
const second = evaluateRestPoseQuality(materialized.document, profile);

assert.deepEqual(second, first, 'rest quality evaluation is deterministic');
assert.equal(
  JSON.stringify({ document: materialized.document, profile }),
  snapshot,
  'rest quality evaluation does not mutate its document or profile'
);
assert.equal(first.ready, true);
assert.equal(first.status.state, 'complete');
assert.equal(first.status.mode, 'standing');
assert.equal(first.status.coreAboveSupport, true);
assert.equal(first.status.centerOfMassSupported, true);
assert.equal(first.status.supportSlotIds.length, 2);
assert.deepEqual(first.issues, []);
assert.deepEqual(first.violations, []);

const invalidProfile: AuthoringProfile = {
  ...profile,
  restPose: { kind: 'canonical-neutral', mode: 'none' },
  slots: profile.slots.map((slot) =>
    slot.parentSlotIds.length === 0 && slot.structuralRole === 'core'
      ? { ...slot, partIds: [...slot.partIds, 'missing.rest.part'] }
      : slot
  )
};
deepFreeze(invalidProfile);
const invalidSnapshot = JSON.stringify(invalidProfile);
const invalid = evaluateRestPoseQuality(
  materialized.document,
  invalidProfile
);
const repeatedInvalid = evaluateRestPoseQuality(
  materialized.document,
  invalidProfile
);

assert.deepEqual(repeatedInvalid, invalid);
assert.equal(JSON.stringify(invalidProfile), invalidSnapshot);
assert.equal(invalid.ready, false);
assert.equal(invalid.status.state, 'invalid');
assert.deepEqual(
  invalid.issues.map((issue) => [issue.code, issue.path]),
  [
    ['authoring.plan.rest_pose_incomplete', 'modeling.parts'],
    ['authoring.plan.rest_pose_support_invalid', 'authoringProfile.restPose'],
    ['authoring.plan.rest_pose_clearance_invalid', 'modeling.parts']
  ],
  'missing, support, and geometry diagnostics retain stage order'
);
assert.deepEqual(
  invalid.violations.map((issue) => [issue.code, issue.path]),
  [
    ['authoring.plan.rest_pose_support_invalid', 'authoringProfile.restPose'],
    ['authoring.plan.rest_pose_clearance_invalid', 'modeling.parts']
  ],
  'incompleteness stays non-violating while invalid stages retain order'
);
