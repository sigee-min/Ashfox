import assert from 'node:assert/strict';

import { evaluateAuthoringPlan } from '../../../src/authoring/plan';
import { materializeIntentProgram } from '../../../src/compiler/program/materialize';
import { createProjectDocument } from '../../../src/project/create';
import { parseIntentProgram } from '../../../src/project/program';
import { intentProgramSource } from '../../program/source';

const source = intentProgramSource({
  name: 'Deterministic plan',
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'base', contacts: ['chassis'] },
  body: [{
    id: 'chassis', kind: 'core', cardinality: 'single'
  }, {
    id: 'cargo', kind: 'mass', cardinality: 'single', parent: 'chassis',
    anchor: 'front', growth: 'forward', lane: 'center'
  }],
  face: { kind: 'none' },
  idle: { mode: 'still' },
  appearance: {
    palette: 'metal',
    texture: {
      kind: 'brushed', scale: 'medium', density: 'sparse', contrast: 'subtle'
    },
    seed: { kind: 'auto' },
    markings: []
  }
});

const parsed = parseIntentProgram(source);
assert.ok(parsed.ir);
assert.ok(parsed.hash);
assert.deepEqual(parsed.diagnostics, []);
const materialized = materializeIntentProgram(createProjectDocument({
  id: 'authoring-plan-determinism',
  name: 'authoring plan determinism',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
}), { source, hash: parsed.hash! });
if (!materialized.ok) throw new Error(materialized.error.message);
assert.equal(materialized.ok, true);

const profileBefore = JSON.stringify(materialized.document.authoringProfile);
const first = evaluateAuthoringPlan(materialized.document);
const second = evaluateAuthoringPlan(materialized.document);
assert.deepEqual(second, first, 'authoring-plan stages are deterministic');
assert.equal(JSON.stringify(materialized.document.authoringProfile), profileBefore,
  'evaluation does not mutate its profile input');
assert.equal(first.ready, true);
assert.deepEqual(
  first.slots.map((slot) => slot.slotId),
  [...first.slots.map((slot) => slot.slotId)].sort((left, right) =>
    left.localeCompare(right)
  ),
  'slot output retains canonical deterministic ordering'
);
