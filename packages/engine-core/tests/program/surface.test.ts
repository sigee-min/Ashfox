import assert from 'node:assert/strict';

import { compileIntentProgram } from '../../src/compiler/program';
import { canonicalJsonString } from '../../src/canonicalJson';
import {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION as language,
  parseIntentProgram
} from '../../src/project/program';
import type { IntentProgramIr } from '../../src/project/program/types';

const source = (
  surfaces: readonly string[],
  shapes: readonly { readonly id: string; readonly fields: readonly string[] }[] = []
): string => [
  'metadata {',
  '  name "Surface grammar"',
  '  track essential',
  '  domain constructed',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support none',
  '  body { core torso }',
  ...surfaces.map((line) => `  ${line}`),
  ...shapes.flatMap((shape) => [
    `  shape ${shape.id} {`,
    ...shape.fields.map((field) => `    ${field}`),
    '  }'
  ]),
  '  face { none }',
  '}',
  'animation { idle still }',
  'appearance {',
  '  palette metal',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}'
].join('\n');

const baseSurface =
  'surface fins paired fin parent torso anchor sides growth outward lane center';
const shapeFields = [
  'axis longitudinal',
  'span long',
  'chord broad',
  'tip forked',
  'offset posterior',
  'edge concave'
];
const parsedBase = parseIntentProgram(source([baseSurface]));
const parsedShape = parseIntentProgram(source(
  [baseSurface],
  [{ id: 'fins', fields: shapeFields }]
));
assert.deepEqual(parsedBase.diagnostics, []);
assert.deepEqual(parsedShape.diagnostics, []);
assert.equal(Object.hasOwn(parsedBase.ir?.surfaces[0] ?? {}, 'shape'), false);
assert.deepEqual(parsedShape.ir?.surfaces[0]?.shape, {
  axis: 'longitudinal', span: 'long', chord: 'broad', tip: 'forked',
  offset: 'posterior', edge: 'concave'
});

const axes = [{
  axis: 'vertical',
  growth: 'outward',
  offsets: ['center', 'dorsal', 'ventral']
}, {
  axis: 'longitudinal',
  growth: 'outward',
  offsets: ['center', 'anterior', 'posterior']
}, {
  axis: 'transverse',
  growth: 'up',
  offsets: ['center', 'medial', 'distal']
}] as const;
for (const fixture of axes) {
  for (const offset of fixture.offsets) {
    const surface = fixture.growth === 'up'
      ? 'surface fins paired fin parent torso anchor sides growth up lane center'
      : baseSurface;
    const parsed = parseIntentProgram(source([surface], [{ id: 'fins', fields: [
      `axis ${fixture.axis}`,
      'span medium',
      'chord medium',
      'tip rounded',
      `offset ${offset}`,
      'edge straight'
    ] }]));
    assert.deepEqual(parsed.diagnostics, [], `${fixture.axis}/${offset}`);
  }
}

for (const fixture of [{
  axis: 'vertical', anchor: 'top', growth: 'up', offset: 'center',
  code: 'intent.surface_shape_axis_parallel'
}, {
  axis: 'longitudinal', anchor: 'front', growth: 'forward', offset: 'center',
  code: 'intent.surface_shape_axis_parallel'
}, {
  axis: 'longitudinal', anchor: 'sides', growth: 'outward', offset: 'dorsal',
  code: 'intent.surface_shape_offset_mismatch'
}] as const) {
  const cardinality = fixture.anchor === 'sides' ? 'paired' : 'single';
  const parsed = parseIntentProgram(source([
    `surface fins ${cardinality} fin parent torso anchor ${fixture.anchor} ` +
      `growth ${fixture.growth} lane center`
  ], [{ id: 'fins', fields: [
    `axis ${fixture.axis}`, 'span medium', 'chord medium', 'tip rounded',
    `offset ${fixture.offset}`, 'edge straight'
  ] }]));
  assert.ok(parsed.diagnostics.some((entry) => entry.code === fixture.code));
  assert.equal(parsed.ir, null);
}

assert.deepEqual(Object.keys(language.surfaceShapes), [
  'axis', 'span', 'chord', 'tip', 'offset', 'edge', 'compatibility'
]);
assert.deepEqual(
  language.surfaceShapes.compatibility.parallelGrowthByAxis,
  {
    vertical: ['up', 'down'],
    longitudinal: ['forward', 'rearward'],
    transverse: ['left', 'right', 'outward']
  }
);
assert.deepEqual(
  language.surfaceShapes.compatibility.allowedOffsetsByAxis,
  {
    vertical: ['center', 'dorsal', 'ventral'],
    longitudinal: ['center', 'anterior', 'posterior'],
    transverse: ['center', 'medial', 'distal']
  }
);
const beforeSurface = parseIntentProgram(source([], [
  { id: 'fins', fields: shapeFields }
]).replace('  face { none }', `  ${baseSurface}\n  face { none }`));
assert.deepEqual(beforeSurface.diagnostics, []);
assert.equal(beforeSurface.canonical, parsedShape.canonical);

const orderedA = parseIntentProgram(source([
  baseSurface,
  'surface wings paired wing parent torso anchor sides growth up lane upper'
], [{ id: 'fins', fields: shapeFields }, { id: 'wings', fields: [
  'axis longitudinal', 'span short', 'chord narrow', 'tip pointed',
  'offset anterior', 'edge concave'
] }]));
const orderedB = parseIntentProgram(source([
  'surface wings paired wing parent torso anchor sides growth up lane upper',
  baseSurface
], [{ id: 'wings', fields: [
  'edge concave', 'offset anterior', 'tip pointed', 'chord narrow',
  'span short', 'axis longitudinal'
] }, { id: 'fins', fields: [...shapeFields].reverse() }]));
assert.deepEqual(orderedA.diagnostics, []);
assert.deepEqual(orderedB.diagnostics, []);
assert.equal(orderedA.canonical, orderedB.canonical);

const compileSurface = (surface: unknown) => compileIntentProgram({
  program: {
    ...parsedShape.ir!,
    surfaces: [surface]
  } as IntentProgramIr,
  sourceMap: parsedShape.sourceMap
});
const canonicalSurface = parsedShape.ir!.surfaces[0]!;
const unknownProperty = compileSurface({
  ...canonicalSurface,
  shape: { ...canonicalSurface.shape, vertices: [0, 1, 2] }
});
assert.equal(unknownProperty.ok, false);
if (!unknownProperty.ok) assert.ok(unknownProperty.diagnostics.some((entry) =>
  entry.code === 'intent-program.unknown-normalized-surface-shape-property'
));

const invalidShape = compileSurface({
  ...canonicalSurface,
  shape: { ...canonicalSurface.shape, axis: 'diagonal' }
});
assert.equal(invalidShape.ok, false);
if (!invalidShape.ok) assert.ok(invalidShape.diagnostics.some((entry) =>
  entry.code === 'intent-program.invalid-normalized-surface-shape'
));

const snapshot = canonicalJsonString(parsedShape.ir);
compileIntentProgram({ program: parsedShape.ir!, sourceMap: parsedShape.sourceMap });
assert.equal(canonicalJsonString(parsedShape.ir), snapshot);
