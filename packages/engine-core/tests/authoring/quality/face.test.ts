import assert from 'node:assert/strict';

import { evaluateAuthoringPlan } from '../../../src/authoring/plan';
import { evaluateFaceQuality } from '../../../src/authoring/quality/face';
import { materializeIntentProgram } from '../../../src/compiler/program/materialize';
import { readPartRecipe } from '../../../src/modeling/recipe';
import { createProjectDocument } from '../../../src/project/create';
import { parseIntentProgram } from '../../../src/project/program';
import { intentProgramSource } from '../../program/source';

const source = intentProgramSource({
  name: 'Face Quality Fixture',
  track: 'hero',
  domain: 'organism',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'feet', contacts: ['legs'] },
  body: [{
    id: 'torso', kind: 'core', cardinality: 'single'
  }, {
    id: 'head', kind: 'mass', cardinality: 'single', parent: 'torso',
    anchor: 'front', growth: 'forward', lane: 'center'
  }, {
    id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'torso',
    anchor: 'sides', growth: 'down', lane: 'center'
  }],
  face: {
    kind: 'full', parent: 'head', eyes: 'paired', gaze: 'center',
    nose: 'absent', mouth: 'neutral'
  },
  idle: { mode: 'breathe', target: 'head' },
  appearance: {
    palette: 'ocean',
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
  id: 'face-quality-fixture',
  name: 'face quality fixture',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
}), { source, hash: parsed.hash });
if (!materialized.ok) throw new Error(materialized.error.message);

const plan = evaluateAuthoringPlan(materialized.document);
assert.ok(plan.profile);
assert.ok(plan.assetQuality);
const recipeRead = readPartRecipe(materialized.document);
if (!recipeRead.ok || !recipeRead.recipe) {
  throw new Error('Expected one materialized face recipe.');
}
const recipe = recipeRead.recipe;

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
deepFreeze(plan.profile);
deepFreeze(plan.slots);
deepFreeze(recipe.parts);
deepFreeze(recipe.materials);
const inputSnapshot = JSON.stringify({
  document: materialized.document,
  profile: plan.profile,
  slots: plan.slots,
  parts: recipe.parts,
  materials: recipe.materials
});
const first = evaluateFaceQuality(
  materialized.document,
  plan.profile,
  plan.slots,
  recipe.parts,
  recipe.materials
);
const second = evaluateFaceQuality(
  materialized.document,
  plan.profile,
  plan.slots,
  recipe.parts,
  recipe.materials
);
assert.deepEqual(second, first, 'face quality evaluation is deterministic');
assert.equal(JSON.stringify({
  document: materialized.document,
  profile: plan.profile,
  slots: plan.slots,
  parts: recipe.parts,
  materials: recipe.materials
}), inputSnapshot, 'face quality evaluation does not mutate any input');
assert.equal(first.ready, true);
assert.equal(first.hostReady, true);
assert.deepEqual(first.issues, []);
assert.deepEqual(first.violations, []);
assert.deepEqual(
  first.components.map((component) => [component.component, component.state]),
  [
    ['eye', 'complete'],
    ['eye-frame', 'complete'],
    ['jaw', 'complete'],
    ['oral', 'complete']
  ]
);

const displacedParts = recipe.parts.map((part) =>
  part.kind === 'feature' && part.partId === 'face.eye.left'
    ? {
        ...part,
        anchor: [
          part.anchor[0] + 50,
          part.anchor[1],
          part.anchor[2]
        ] as const
      }
    : part
);
const displacedDocument = {
  ...materialized.document,
  modeling: {
    ...materialized.document.modeling!,
    parts: displacedParts
  }
};
const displaced = evaluateFaceQuality(
  displacedDocument,
  plan.profile,
  plan.slots,
  displacedParts,
  recipe.materials
);
assert.deepEqual(
  displaced.issues.map((issue) => [issue.code, issue.path]),
  [
    [
      'authoring.plan.face_eye_gaze_invalid',
      'authoringProfile.face.components.eye'
    ],
    [
      'authoring.plan.face_eye_gaze_invalid',
      'authoringProfile.face.components.eye'
    ],
    [
      'authoring.plan.face_eye_unreadable',
      'authoringProfile.face.components.eye'
    ],
    ...Array.from({ length: 3 }, () => [
      'authoring.plan.face_eye_visibility_invalid',
      'modeling.parts.face.eye.left'
    ])
  ],
  'geometry, reflection, status, then visibility diagnostics retain exact order'
);
assert.deepEqual(displaced.violations, displaced.issues);

const incompleteSlots = plan.slots.map((slot) =>
  slot.slotId.startsWith('slot.face.') && slot.slotId !== 'slot.face.host'
    ? { ...slot, state: 'missing' as const }
    : slot
);
const invalid = evaluateFaceQuality(
  materialized.document,
  plan.profile,
  incompleteSlots,
  recipe.parts,
  recipe.materials
);
assert.equal(invalid.ready, false);
assert.deepEqual(
  invalid.issues.map((issue) => [issue.code, issue.path]),
  [
    [
      'authoring.plan.face_eye_unreadable',
      'authoringProfile.face.components.eye'
    ],
    [
      'authoring.plan.face_component_incomplete',
      'authoringProfile.face.components.eye-frame'
    ],
    [
      'authoring.plan.face_component_incomplete',
      'authoringProfile.face.components.jaw'
    ],
    [
      'authoring.plan.face_component_incomplete',
      'authoringProfile.face.components.oral'
    ]
  ],
  'component diagnostics retain declaration and insertion order'
);
assert.deepEqual(
  invalid.violations.map((issue) => [issue.code, issue.path]),
  [[
    'authoring.plan.face_eye_unreadable',
    'authoringProfile.face.components.eye'
  ]]
);
assert.deepEqual(
  invalid.components.map((component) => [
    component.component,
    component.state
  ]),
  [
    ['eye', 'incomplete'],
    ['eye-frame', 'incomplete'],
    ['jaw', 'incomplete'],
    ['oral', 'incomplete']
  ]
);
