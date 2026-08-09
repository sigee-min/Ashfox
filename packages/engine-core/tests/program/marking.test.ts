import assert from 'node:assert/strict';

import { compileIntentProgram } from '../../src/compiler/program';
import { materializeIntentProgram } from '../../src/compiler/program/materialize';
import { canonicalJsonString } from '../../src/canonicalJson';
import { createProjectDocument } from '../../src/project/create';
import { parseIntentProgram } from '../../src/project/program';
import { normalizeProjectIntent } from '../../src/project/intent';

const source = [
  'metadata {',
  '  name "Marked glider"',
  '  track hero',
  '  domain organism',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support none',
  '  body {',
  '    core torso',
  '    mass head single parent torso anchor front growth forward lane center',
  '  }',
  '  surface fins paired fin parent torso anchor sides growth outward lane center',
  '  face {',
  '    full parent head',
  '    eyes paired gaze center',
  '    nose present',
  '    mouth neutral',
  '  }',
  '}',
  'animation {',
  '  idle breathe',
  '}',
  'appearance {',
  '  palette ocean',
  '  texture mottle scale broad density balanced contrast subtle',
  '  seed reef-17',
  '  mark belly target body torso region ventral placement whole as wash tone lighter scale broad density sparse contrast subtle',
  '  mark brow target face region dorsal placement center as band tone darker flow transverse scale fine density sparse contrast medium',
  '  mark fin-tips target surface fins region full placement tip as patch tone accent variant reef scale medium density sparse contrast bold',
  '}'
].join('\n');

const parsed = parseIntentProgram(source);
assert.deepEqual(parsed.diagnostics, []);
assert.ok(parsed.ir && parsed.hash);
const compiled = compileIntentProgram({
  program: parsed.ir,
  sourceMap: parsed.sourceMap
});
if (!compiled.ok) throw new Error(compiled.diagnostics.map(
  (diagnostic) => diagnostic.message
).join('\n'));

assert.deepEqual(
  compiled.plan.projectIntent.appearance?.markings.map((marking) => marking.id),
  ['belly', 'brow', 'fin-tips'],
  'normalized authored appearance uses stable marking-ID order'
);
const bindings = new Map(
  compiled.plan.projectIntent.appearanceBindings?.map((binding) => [
    binding.markingId,
    binding
  ])
);
assert.deepEqual(bindings.get('belly')?.partIds, ['core.torso']);
assert.equal(bindings.get('brow')?.faceScope, 'anterior');
assert.ok(bindings.get('brow')?.partIds.includes('face.host'));
assert.ok(bindings.get('fin-tips')?.partIds.some((partId) =>
  partId.includes('membrane')
));
assert.equal(
  bindings.get('fin-tips')?.accentColor,
  '#68B8C7',
  'accent tone receives the selected compiler palette without entering source IR'
);
assert.equal(
  normalizeProjectIntent(compiled.plan.projectIntent).ok,
  true,
  'resolved appearance intent and bindings pass the persisted closed reader'
);

const project = createProjectDocument({
  id: 'marked-glider',
  name: 'Marked glider',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
});
const materialized = materializeIntentProgram(project, {
  source,
  hash: parsed.hash
});
if (!materialized.ok) throw new Error(materialized.error.message);
assert.equal(materialized.document.intent?.appearance?.version, 1);
assert.deepEqual(
  materialized.document.intent?.appearanceBindings,
  compiled.plan.projectIntent.appearanceBindings,
  'materialization persists the exact compiler-owned target realization'
);

const second = materializeIntentProgram(project, {
  source,
  hash: parsed.hash
});
if (!second.ok) throw new Error(second.error.message);
assert.equal(
  canonicalJsonString(materialized.document),
  canonicalJsonString(second.document),
  'appearance materialization is deterministic from the same source'
);

const invalid = parseIntentProgram(source.replace(
  'target surface fins',
  'target surface missing-fins'
));
const unknown = invalid.diagnostics.find((diagnostic) =>
  diagnostic.code === 'intent.unknown_appearance_target'
);
assert.equal(unknown?.span.start.offset, invalid.source.indexOf('missing-fins'));

const focalSource = [
  'metadata {',
  '  name "Marked beacon"',
  '  track hero',
  '  domain constructed',
  '}',
  'model {',
  '  orientation forward east',
  '  symmetry bilateral',
  '  support none',
  '  body {',
  '    core chassis',
  '  }',
  '  face {',
  '    none',
  '  }',
  '  focal beacon parent chassis',
  '}',
  'animation {',
  '  idle scan',
  '}',
  'appearance {',
  '  palette metal',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '  mark signal target focal beacon region full placement center as patch tone accent scale medium density sparse contrast bold',
  '}'
].join('\n');
const focalParsed = parseIntentProgram(focalSource);
assert.deepEqual(focalParsed.diagnostics, []);
assert.ok(focalParsed.ir);
const focalCompiled = compileIntentProgram({
  program: focalParsed.ir,
  sourceMap: focalParsed.sourceMap
});
if (!focalCompiled.ok) throw new Error(focalCompiled.diagnostics.map(
  (diagnostic) => diagnostic.message
).join('\n'));
assert.deepEqual(
  focalCompiled.plan.projectIntent.appearanceBindings?.[0],
  {
    markingId: 'signal',
    partIds: ['focal.beacon'],
    faceScope: 'full',
    accentColor: '#C48C47'
  },
  'focal targets resolve to their compiler-owned focal part without ID guessing'
);
