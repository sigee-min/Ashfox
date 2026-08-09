import assert from 'node:assert/strict';

import { parseIntentProgram } from '../../src/project/program';
import { tokenizeIntentProgram } from '../../src/project/program/lexer';
import { IntentProgramReader } from '../../src/project/program/reader';

const fixture = [
  'metadata {',
  '  name "Reader Fixture"',
  '  track hero',
  '  domain organism',
  '}',
  'model {',
  '  orientation forward west',
  '  symmetry bilateral',
  '  support feet contacts legs',
  '  body {',
  '    core torso',
  '    mass head single parent torso anchor front growth forward lane center',
  '    limb legs paired parent torso anchor sides growth down lane center',
  '  }',
  '  surface fins paired fin parent torso anchor sides growth outward lane upper',
  '  shape fins {',
  '    axis longitudinal',
  '    span long',
  '    chord broad',
  '    tip forked',
  '    offset posterior',
  '    edge concave',
  '  }',
  '  face {',
  '    full parent head',
  '    eyes paired gaze center',
  '    nose absent',
  '    mouth neutral',
  '  }',
  '}',
  'animation { idle breathe target head }',
  'appearance {',
  '  palette ocean',
  '  texture mottle scale broad density balanced contrast subtle',
  '  seed reader-17',
  '}'
].join('\n');

const parsed = parseIntentProgram(fixture);
assert.deepEqual(parsed.diagnostics, []);
assert.ok(parsed.ir);
assert.equal(parsed.ir?.name, 'Reader Fixture');
assert.equal(parsed.ir?.orientation.forward, 'west');
assert.equal(parsed.ir?.surfaces[0]?.shape?.axis, 'longitudinal');
assert.equal(parsed.sourceMap['body.head.parent']?.start.line, 12);
assert.equal(parsed.sourceMap['surfaces.fins.shape.tip']?.start.line, 20);
assert.equal(parsed.sourceMap['appearance.seed']?.start.line, 35);

const lexical = tokenizeIntentProgram(fixture);
const reader = new IntentProgramReader(lexical.tokens, lexical.diagnostics);
reader.parse();
assert.equal(reader.raw.authorities.metadata, true);
assert.equal(reader.raw.model.body.length, 3);
assert.equal(reader.raw.model.surfaceShapes[0]?.surfaceId, 'fins');

const permuted = [
  'appearance {',
  '  seed reader-17',
  '  texture mottle scale broad density balanced contrast subtle',
  '  palette ocean',
  '}',
  'animation { idle breathe target head }',
  'model {',
  '  face {',
  '    full parent head',
  '    mouth neutral',
  '    nose absent',
  '    eyes paired gaze center',
  '  }',
  '  shape fins {',
  '    edge concave',
  '    offset posterior',
  '    tip forked',
  '    chord broad',
  '    span long',
  '    axis longitudinal',
  '  }',
  '  surface fins paired fin parent torso anchor sides growth outward lane upper',
  '  body {',
  '    limb legs paired parent torso anchor sides growth down lane center',
  '    mass head single parent torso anchor front growth forward lane center',
  '    core torso',
  '  }',
  '  support feet contacts legs',
  '  symmetry bilateral',
  '  orientation forward west',
  '}',
  'metadata {',
  '  domain organism',
  '  track hero',
  '  name "Reader Fixture"',
  '}'
].join('\n');
const parsedPermutation = parseIntentProgram(permuted);
assert.deepEqual(parsedPermutation.diagnostics, []);
assert.equal(parsedPermutation.canonical, parsed.canonical);
assert.equal(parsedPermutation.hash, parsed.hash);

const codes = (source: string): readonly string[] =>
  parseIntentProgram(source).diagnostics.map((entry) => entry.code);

for (const block of ['metadata', 'model', 'animation', 'appearance'] as const) {
  const without = fixture.replace(
    new RegExp(`${block} \\{[\\s\\S]*?^\\}`, 'm'),
    ''
  );
  assert.ok(codes(without).includes('intent.missing_authority_block'), block);
}

assert.ok(codes(`${fixture}\nmetadata { name "Duplicate" }`).includes(
  'intent.duplicate_authority_block'
));
assert.ok(codes(fixture.replace(
  '  name "Reader Fixture"',
  '  idle still'
)).includes('intent.wrong_authority'));
assert.ok(codes(fixture.replace(
  '  name "Reader Fixture"',
  '  name { nested bad }'
)).includes('intent.invalid_nested_block'));
assert.ok(codes(fixture.replace(/}\s*$/, '')).includes('intent.unclosed_block'));
assert.ok(codes(`unknown { ignored value }\n${fixture}`).includes(
  'intent.unknown_root_block'
));
assert.ok(codes('asset "Legacy flat"').includes('intent.unknown_root_block'));

const malformedShape = fixture.replace(
  '    edge concave',
  '    edge concave\n    vertices forbidden'
);
const shapeError = parseIntentProgram(malformedShape).diagnostics.find(
  (entry) => entry.code === 'intent.unknown_surface_shape_property'
);
assert.equal(shapeError?.span.start.line, 23);

const incompleteShape = fixture.replace('    chord broad\n', '');
assert.ok(codes(incompleteShape).includes('intent.missing_surface_shape_property'));
const duplicateShape = fixture.replace(
  '    span long',
  '    span long\n    span short'
);
assert.ok(codes(duplicateShape).includes('intent.duplicate_surface_shape_property'));
