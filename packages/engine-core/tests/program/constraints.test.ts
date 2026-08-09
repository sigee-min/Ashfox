import assert from 'node:assert/strict';

import {
  collectIntentProgramConstraintIssues,
  parseIntentProgram
} from '../../src/project/program';
import type { IntentProgramSemanticAst } from '../../src/project/program/types';

const source = (model: readonly string[]): string => [
  'metadata {',
  '  name "Constraint fixture"',
  '  track essential',
  '  domain constructed',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  ...model.map((line) => `  ${line}`),
  '  face { none }',
  '}',
  'animation { idle still }',
  'appearance {',
  '  palette metal',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}'
].join('\n');

const valid = parseIntentProgram(source([
  'support none',
  'body {',
  '  core torso',
  '}',
  'surface belly single fin parent torso anchor bottom growth down lane center'
]));
assert.deepEqual(valid.diagnostics, []);
assert.equal(valid.ir?.surfaces[0]?.growth, 'down');

const feetForward = parseIntentProgram(source([
  'support feet contacts legs',
  'body {',
  '  core torso',
  '  limb legs paired parent torso anchor sides growth forward lane center',
  '}'
]));
assert.ok(feetForward.diagnostics.some((entry) =>
  entry.code === 'intent.invalid_feet_contact_growth'
));
assert.equal(feetForward.ir, null);

for (const fixture of [{
  support: 'support feet contacts torso',
  body: ['body { core torso }'],
  code: 'intent.invalid_feet_contact'
}, {
  support: 'support wheels contacts legs',
  body: [
    'body {',
    '  core torso',
    '  limb legs paired parent torso anchor sides growth down lane center',
    '}'
  ],
  code: 'intent.invalid_wheel_contact'
}, {
  support: 'support base contacts legs',
  body: [
    'body {',
    '  core torso',
    '  limb legs paired parent torso anchor sides growth down lane center',
    '}'
  ],
  code: 'intent.invalid_base_contact'
}] as const) {
  const parsed = parseIntentProgram(source([fixture.support, ...fixture.body]));
  assert.ok(
    parsed.diagnostics.some((entry) => entry.code === fixture.code),
    `${fixture.support} must consume the published contact compatibility`
  );
}

const unsupportedWheel = parseIntentProgram(source([
  'support none',
  'body {',
  '  core chassis',
  '  wheel wheels paired parent chassis anchor sides growth down lane center',
  '}'
]));
assert.ok(unsupportedWheel.diagnostics.some((entry) =>
  entry.code === 'intent.wheel_requires_wheel_support'
));

const organismBase = parseIntentProgram(source([
  'support base contacts torso',
  'body { core torso }'
]).replace('domain constructed', 'domain organism'));
assert.ok(organismBase.diagnostics.some((entry) =>
  entry.code === 'intent.incompatible_domain_support'
));

const animationOnLimb = parseIntentProgram(source([
  'support feet contacts legs',
  'body {',
  '  core torso',
  '  limb legs paired parent torso anchor sides growth down lane center',
  '}'
]).replace('idle still', 'idle scan target legs'));
assert.ok(animationOnLimb.diagnostics.some((entry) =>
  entry.code === 'intent.unsupported_animation_target'
));

const presentationConflict = parseIntentProgram([
  'metadata {',
  '  name "Presentation conflict"',
  '  track hero',
  '  domain constructed',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support base contacts torso',
  '  body {',
  '    core torso',
  '    mass cargo single parent torso anchor front growth forward lane center',
  '  }',
  '  face { none }',
  '  focal beacon parent torso',
  '}',
  'animation { idle still }',
  'appearance {',
  '  palette metal',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}'
].join('\n'));
assert.ok(presentationConflict.diagnostics.some((entry) =>
  entry.code === 'intent.presentation_slot_conflict'
));

const faceSurface = (lane: 'center' | 'upper'): ReturnType<
  typeof parseIntentProgram
> => parseIntentProgram(source([
  'support none',
  'body {',
  '  core torso',
  '  mass head single parent torso anchor front growth forward lane center',
  '}',
  `surface brow single fin parent head anchor front growth rearward lane ${lane}`
]).replace(
  'track essential', 'track hero'
).replace(
  'face { none }',
  [
    'face {',
    '    full parent head',
    '    eyes paired gaze center',
    '    nose absent',
    '    mouth neutral',
    '  }'
  ].join('\n')
));
assert.equal(
  faceSurface('upper').diagnostics.some((entry) =>
    entry.code === 'intent.presentation_slot_conflict'
  ),
  false
);
assert.ok(faceSurface('center').diagnostics.some((entry) =>
  entry.code === 'intent.presentation_slot_conflict'
));

const modules = Array.from({ length: 96 }, (_, index) => {
  const id = `node-${String(index).padStart(3, '0')}`;
  const parent = index === 0
    ? 'root'
    : `node-${String(index - 1).padStart(3, '0')}`;
  return {
    id,
    kind: 'mass' as const,
    cardinality: 'single' as const,
    parent,
    anchor: 'front' as const,
    growth: 'forward' as const,
    lane: 'center' as const
  };
});
const semantic: IntentProgramSemanticAst = {
  authorities: {
    metadata: true, model: true, animation: true, appearance: true
  },
  metadata: {
    name: 'Bounded resolver', track: 'essential', domain: 'constructed'
  },
  model: {
    orientation: { forward: 'north' },
    symmetry: 'bilateral',
    support: { kind: 'none', contacts: [] },
    body: [{ id: 'root', kind: 'core', cardinality: 'single' }, ...modules],
    surfaces: [],
    surfaceShapes: [],
    face: { kind: 'none' }
  },
  animation: { idle: { mode: 'still' } },
  appearance: {
    palette: 'metal',
    texture: {
      kind: 'brushed', scale: 'medium', density: 'sparse', contrast: 'subtle'
    },
    seed: { kind: 'auto' },
    markings: []
  }
};
const duplicateModule = modules[0]!;
const duplicateSurface = {
  id: 'fin', role: 'fin' as const, cardinality: 'single' as const,
  parent: 'root', anchor: 'top' as const, growth: 'up' as const,
  lane: 'center' as const
};
const invariantInspection = collectIntentProgramConstraintIssues({
  ...semantic,
  metadata: { ...semantic.metadata, name: '  Noncanonical   name  ' },
  model: {
    ...semantic.model,
    body: [
      { id: 'root', kind: 'core', cardinality: 'single' },
      duplicateModule,
      { ...duplicateModule }
    ],
    surfaces: [duplicateSurface, { ...duplicateSurface }]
  }
});
const invariantCodes = new Set(invariantInspection.issues.map(
  (issue) => issue.code
));
assert.ok(invariantCodes.has('intent.noncanonical_name'));
assert.ok(invariantCodes.has('intent.duplicate_body_id'));
assert.ok(invariantCodes.has('intent.duplicate_surface_id'));
const missingCore = collectIntentProgramConstraintIssues({
  ...semantic,
  model: {
    ...semantic.model,
    body: [duplicateModule]
  }
});
assert.ok(missingCore.issues.some((issue) =>
  issue.code === 'intent.requires_one_core'
));
const frozen = JSON.stringify(semantic);
const first = collectIntentProgramConstraintIssues(semantic);
const second = collectIntentProgramConstraintIssues(semantic);
assert.deepEqual(second, first);
assert.equal(JSON.stringify(semantic), frozen);
assert.equal(first.metrics.graphEdges, 96);
assert.ok(first.metrics.heapPushes <= 97);
assert.ok(first.metrics.heapPops <= 97);
assert.ok(first.metrics.heapComparisons <= 97 * 8);
assert.ok(first.metrics.attachmentConflictChecks <= 96);

const wideCount = 192;
const wideModules = Array.from({ length: wideCount }, (_, index) => ({
  id: `leg-${String(index).padStart(3, '0')}`,
  kind: 'limb' as const,
  cardinality: 'paired' as const,
  parent: 'root',
  anchor: 'sides' as const,
  growth: 'down' as const,
  lane: 'center' as const
}));
const wideSurfaces = Array.from({ length: wideCount }, (_, index) => ({
  id: `fin-${String((index * 97) % wideCount).padStart(3, '0')}`,
  role: 'fin' as const,
  cardinality: 'paired' as const,
  parent: 'root',
  anchor: 'sides' as const,
  growth: 'outward' as const,
  lane: 'center' as const
}));
const wideSemantic: IntentProgramSemanticAst = {
  ...semantic,
  model: {
    ...semantic.model,
    support: {
      kind: 'feet',
      contacts: wideModules.map((module) => module.id).reverse()
    },
    body: [
      { id: 'root', kind: 'core', cardinality: 'single' },
      ...wideModules
    ],
    surfaces: wideSurfaces
  }
};
const wideSnapshot = JSON.stringify(wideSemantic);
const wide = collectIntentProgramConstraintIssues(wideSemantic);
assert.equal(JSON.stringify(wideSemantic), wideSnapshot);
assert.equal(wide.metrics.graphEdges, wideCount);
assert.ok(wide.metrics.heapPushes <= wideCount + 1);
assert.ok(wide.metrics.heapPops <= wideCount + 1);
const heapComparisonBound =
  4 * (wideCount + 1) * Math.ceil(Math.log2(wideCount + 2));
assert.ok(wide.metrics.heapComparisons <= heapComparisonBound);
assert.ok(wide.metrics.attachmentConflictChecks <= wideCount * 2);
assert.ok(wide.metrics.targetChecks <= wideCount);
assert.ok(wide.metrics.surfaceOrderComparisons <= wideCount * 16);
assert.ok(wide.metrics.supportOrderComparisons <= wideCount * 16);

const cyclicSemantic: IntentProgramSemanticAst = {
  ...semantic,
  model: {
    ...semantic.model,
    body: [
      { id: 'root', kind: 'core', cardinality: 'single' },
      {
        id: 'a', kind: 'mass', cardinality: 'single', parent: 'b',
        anchor: 'front', growth: 'forward', lane: 'center'
      },
      {
        id: 'b', kind: 'mass', cardinality: 'single', parent: 'a',
        anchor: 'front', growth: 'forward', lane: 'center'
      },
      {
        id: 'c', kind: 'mass', cardinality: 'single', parent: 'a',
        anchor: 'front', growth: 'forward', lane: 'upper'
      }
    ]
  }
};
const cyclicSnapshot = JSON.stringify(cyclicSemantic);
const cyclicFirst = collectIntentProgramConstraintIssues(cyclicSemantic);
const cyclicSecond = collectIntentProgramConstraintIssues(cyclicSemantic);
const cyclePaths = cyclicFirst.issues
  .filter((issue) => issue.code === 'intent.body_parent_cycle')
  .map((issue) => issue.path);
assert.deepEqual(cyclePaths, ['body.a.parent', 'body.b.parent']);
assert.equal(cyclePaths.includes('body.c.parent'), false);
assert.deepEqual(cyclicSecond, cyclicFirst);
assert.equal(JSON.stringify(cyclicSemantic), cyclicSnapshot);
assert.equal(cyclicFirst.metrics.graphEdges, 3);
assert.ok(cyclicFirst.metrics.heapPushes <= 1);
assert.ok(cyclicFirst.metrics.heapPops <= 1);
