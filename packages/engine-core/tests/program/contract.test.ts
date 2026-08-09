import assert from 'node:assert/strict';

import { compileIntentProgram } from '../../src/compiler/program';
import {
  INTENT_PROGRAM_MODULE_STRUCTURAL_ROLES
} from '../../src/compiler/program/capability';
import {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
  INTENT_PROGRAM_LANGUAGE_VERSION,
  parseIntentProgram,
  resolveIntentProgramSourceSpan
} from '../../src/project/program';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr
} from '../../src/project/program/types';

const hasCode = (source: string, code: string): boolean =>
  parseIntentProgram(source).diagnostics.some((entry) => entry.code === code);

assert.equal(INTENT_PROGRAM_LANGUAGE_VERSION, 1);
assert.equal(INTENT_PROGRAM_LANGUAGE_SPECIFICATION.version, 1);
assert.ok(INTENT_PROGRAM_LANGUAGE_SPECIFICATION.model.moduleKinds.includes('wheel'));
assert.ok(INTENT_PROGRAM_LANGUAGE_SPECIFICATION.lanes.includes('trailing'));
assert.ok(INTENT_PROGRAM_LANGUAGE_SPECIFICATION.identifier.pattern.test('front-leg'));
assert.deepEqual(INTENT_PROGRAM_MODULE_STRUCTURAL_ROLES, {
  core: 'core',
  mass: 'core',
  chain: 'axis',
  limb: 'articulated',
  wheel: 'rotary',
  radial: 'rotary'
});

const heroFaceSource = [
  'metadata {',
  '  name "Lantern Hound"',
  '  track hero',
  '  domain organism',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support feet contacts legs',
  '  body {',
  '    core torso',
  '    mass head single parent torso anchor front growth forward lane center',
  '    limb legs paired parent torso anchor sides growth down lane center',
  '  }',
  '  surface wings paired fin parent torso anchor sides growth up lane upper',
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
  '  palette ember',
  '  texture mottle scale broad density balanced contrast subtle',
  '  seed auto',
  '}'
].join('\n');

const parsedHero = parseIntentProgram(heroFaceSource);
assert.deepEqual(parsedHero.diagnostics, []);
assert.deepEqual(parsedHero.ir?.body.find((module) => module.id === 'head'), {
  id: 'head',
  kind: 'mass',
  cardinality: 'single',
  parent: 'torso',
  anchor: 'front',
  growth: 'forward',
  lane: 'center'
});
assert.equal(parsedHero.ir?.face.kind, 'full');
if (parsedHero.ir?.face.kind === 'full') {
  assert.equal(parsedHero.ir.face.parent, 'head');
}
assert.deepEqual(parsedHero.ir?.animation, { idle: { mode: 'breathe' } });
assert.equal(parsedHero.sourceMap['body.head.parent']?.start.line, 12);
assert.equal(parsedHero.sourceMap['surfaces.wings.growth']?.start.line, 15);
assert.equal(parsedHero.sourceMap['face.parent']?.start.line, 17);
assert.equal(
  resolveIntentProgramSourceSpan(
    parsedHero.sourceMap,
    'body.head.parent.generated-port'
  )?.start.line,
  12
);
assert.ok(parsedHero.ast.statements.some((statement) =>
  statement.fields.some((field) =>
    field.path === 'face.parent' && field.span.start.line === 17
  )
));

const heroFocalSource = [
  'metadata {',
  '  name "Courier"',
  '  track hero',
  '  domain constructed',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support wheels contacts wheels',
  '  body {',
  '    core chassis',
  '    wheel wheels paired parent chassis anchor sides growth down lane center',
  '  }',
  '  face { none }',
  '  focal beacon parent chassis',
  '}',
  'animation { idle scan }',
  'appearance {',
  '  palette metal',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}'
].join('\n');
const parsedFocal = parseIntentProgram(heroFocalSource);
assert.deepEqual(parsedFocal.diagnostics, []);
assert.deepEqual(parsedFocal.ir?.focal, { id: 'beacon', parent: 'chassis' });
assert.deepEqual(parsedFocal.ir?.support, {
  kind: 'wheels', contacts: ['wheels']
});

const multiSupportSource = heroFaceSource
  .replace('support feet contacts legs',
    'support feet contacts rear-legs front-legs')
  .replace(
    '    limb legs paired parent torso anchor sides growth down lane center',
    [
      '    limb rear-legs paired parent torso anchor sides growth down lane trailing',
      '    limb front-legs paired parent torso anchor sides growth down lane leading'
    ].join('\n')
  )
  .replace('idle breathe', 'idle breathe target head');
const parsedMulti = parseIntentProgram(multiSupportSource);
assert.deepEqual(parsedMulti.diagnostics, []);
assert.deepEqual(parsedMulti.ir?.support, {
  kind: 'feet', contacts: ['front-legs', 'rear-legs']
});
assert.equal(
  parsedMulti.sourceMap['support.contacts.front-legs']?.start.line,
  9
);
assert.equal(parsedMulti.sourceMap['animation.idle.target']?.start.line, 25);

assert.equal(hasCode(
  heroFocalSource.replace(
    'support wheels contacts wheels',
    'support base contacts chassis wheels'
  ),
  'intent.invalid_support_cardinality'
), true);
assert.equal(hasCode(
  multiSupportSource.replace(
    'rear-legs front-legs',
    'front-legs front-legs'
  ),
  'intent.duplicate_support_contact'
), true);
assert.equal(hasCode(
  multiSupportSource.replace('target head', 'target missing-head'),
  'intent.unknown_animation_target'
), true);

assert.equal(hasCode('asset "legacy"', 'intent.unknown_root_block'), true);
assert.equal(hasCode('metadata { name "unterminated', 'intent.unclosed_string'), true);
assert.equal(hasCode('metadata { name "bad\\q"', 'intent.invalid_escape'), true);
assert.equal(hasCode(
  heroFaceSource.replace('limb legs paired', 'limb legs pair'),
  'intent.invalid_body_relation'
), true);
assert.equal(hasCode(
  heroFaceSource.replace('paired fin', 'paired membrane'),
  'intent.invalid_surface'
), true);
assert.equal(hasCode(
  heroFaceSource.replace('support feet contacts legs', 'rest feet on legs'),
  'intent.wrong_authority'
), true);
assert.equal(hasCode(
  heroFaceSource.replace('growth up lane upper', 'growth lateral lane upper'),
  'intent.invalid_surface'
), true);
const singleSidedSurface = heroFaceSource.replace(
  'surface wings paired fin parent torso anchor sides growth up lane upper',
  'surface wing single fin parent torso anchor left growth left lane upper'
);
assert.equal(hasCode(
  singleSidedSurface,
  'intent.single_sided_surface_requires_asymmetric'
), true);
assert.equal(hasCode(
  singleSidedSurface.replace('symmetry bilateral', 'symmetry asymmetric'),
  'intent.single_sided_surface_requires_asymmetric'
), false);
assert.equal(hasCode(
  heroFaceSource.replace('core torso', 'core "Main Body"'),
  'intent.invalid_identifier'
), true);
assert.equal(hasCode(
  heroFaceSource.replace('full parent head', 'full'),
  'intent.invalid_face_parent_marker'
), true);
assert.equal(hasCode(
  heroFaceSource.replace('  idle breathe\n', ''),
  'intent.missing_required'
), true);
assert.equal(hasCode(
  heroFaceSource.replace('  palette ember\n', ''),
  'intent.incomplete_appearance'
), true);

const missingNamePermuted = [
  'appearance {',
  '  palette metal',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}',
  'animation { idle still }',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support none',
  '  body { core torso }',
  '  face { none }',
  '}',
  'metadata {',
  '  track essential',
  '  domain constructed',
  '}'
].join('\n');
const missingNameResult = parseIntentProgram(missingNamePermuted);
const missingName = missingNameResult.diagnostics.find((entry) =>
  entry.code === 'intent.missing_required' && /name/.test(entry.message)
);
assert.equal(
  missingName?.span.start.line,
  14,
  'missing metadata leaves must point at their owning block, not line 1'
);

const facelessHero = heroFaceSource.replace(
  /  face \{[\s\S]*?  \}\n}\nanimation/,
  '  face { none }\n}\nanimation'
);
assert.equal(hasCode(
  facelessHero,
  'intent.hero_requires_one_focal_stage'
), true);
assert.equal(hasCode(
  heroFocalSource.replace('  face { none }', [
    '  face {',
    '    full parent chassis',
    '    eyes paired gaze center',
    '    nose present',
    '    mouth neutral',
    '  }'
  ].join('\n')),
  'intent.hero_requires_one_focal_stage'
), true);
assert.equal(hasCode(
  heroFocalSource.replace('track hero', 'track essential'),
  'intent.focal_requires_hero_track'
), true);

const compileUnknown = (program: unknown) => compileIntentProgram({
  program: program as IntentProgramIr,
  sourceMap: parsedHero.sourceMap
});
const missingPalette = compileUnknown({
  ...parsedHero.ir,
  appearance: {
    version: 1,
    seed: parsedHero.ir?.appearance.seed,
    texture: parsedHero.ir?.appearance.texture,
    markings: []
  }
});
assert.equal(missingPalette.ok, false);
if (!missingPalette.ok) assert.ok(missingPalette.diagnostics.some((entry) =>
  entry.code === 'intent-program.invalid-normalized-palette'
));

const incompleteFace = compileUnknown({
  ...parsedHero.ir,
  face: { kind: 'full', parent: 'head', eyes: 'paired' }
});
assert.equal(incompleteFace.ok, false);
if (!incompleteFace.ok) assert.ok(incompleteFace.diagnostics.some((entry) =>
  entry.code === 'intent-program.incomplete-normalized-face'
));

const noncanonicalName = compileUnknown({
  ...parsedHero.ir,
  name: '  Lantern   Hound  '
});
assert.equal(noncanonicalName.ok, false);
if (!noncanonicalName.ok) assert.ok(noncanonicalName.diagnostics.some((entry) =>
  entry.code === 'intent-program.invalid-normalized-name'
));

const invalidIdPrograms: readonly [unknown, string][] = [
  [{
    ...parsedHero.ir,
    body: parsedHero.ir?.body.map((module) => module.id === 'head'
      ? { ...module, id: 'bad.id' }
      : module)
  }, 'intent-program.invalid-normalized-module-id'],
  [{
    ...parsedHero.ir,
    body: parsedHero.ir?.body.map((module) => module.id === 'head'
      ? { ...module, parent: '1bad' }
      : module)
  }, 'intent-program.incomplete-normalized-module'],
  [{
    ...parsedHero.ir,
    surfaces: parsedHero.ir?.surfaces.map((surface) => ({
      ...surface, id: 'bad.id', parent: '1bad'
    }))
  }, 'intent-program.invalid-normalized-surface'],
  [{
    ...parsedHero.ir,
    support: { kind: 'feet', contacts: ['bad.id'] }
  }, 'intent-program.invalid-normalized-support-contact'],
  [{
    ...parsedHero.ir,
    face: { ...parsedHero.ir?.face, kind: 'full', parent: '1bad' }
  }, 'intent-program.incomplete-normalized-face'],
  [{
    ...parsedHero.ir,
    animation: { idle: { mode: 'scan', target: 'bad.id' } }
  }, 'intent-program.invalid-normalized-animation-target'],
  [{
    ...parsedFocal.ir,
    focal: { id: 'bad.id', parent: '1bad' }
  }, 'intent-program.invalid-normalized-focal-id'],
  [{
    ...parsedHero.ir,
    appearance: {
      ...parsedHero.ir?.appearance,
      markings: [{
        id: 'bad.id',
        target: { kind: 'body', id: '1bad' },
        region: 'full', placement: 'whole', motif: 'wash', tone: 'lighter',
        scale: 'broad', density: 'sparse', contrast: 'subtle'
      }]
    }
  }, 'intent-program.invalid-normalized-appearance']
];
for (const [program, expectedCode] of invalidIdPrograms) {
  const result = compileUnknown(program);
  assert.equal(result.ok, false, expectedCode);
  if (!result.ok) assert.ok(
    result.diagnostics.some((entry) => entry.code === expectedCode),
    expectedCode
  );
}

const directSlotConflict = compileUnknown({
  ...parsedHero.ir,
  surfaces: parsedHero.ir?.surfaces.map((surface) => ({
    ...surface,
    cardinality: 'single',
    parent: 'torso',
    anchor: 'front',
    growth: 'forward',
    lane: 'center'
  }))
});
assert.equal(directSlotConflict.ok, false);
if (!directSlotConflict.ok) assert.ok(directSlotConflict.diagnostics.some(
  (entry) => entry.code === 'intent.attachment_slot_conflict'
));

const directRelationCases = [
  ['cardinality', 'paired'],
  ['anchor', 'sides'],
  ['growth', 'down']
] as const;
for (const [field, value] of directRelationCases) {
  const result = compileUnknown({
    ...parsedHero.ir,
    body: parsedHero.ir?.body.map((module) => module.id === 'head'
      ? { ...module, [field]: value }
      : module)
  });
  assert.equal(result.ok, false, `direct IR must reject invalid ${field}`);
  if (!result.ok) {
    const issue = result.diagnostics.find(
      (entry) => entry.code === 'intent.invalid_body_attachment'
    );
    assert.deepEqual(
      issue?.span,
      parsedHero.sourceMap[`body.head.${field}`],
      `direct IR ${field} diagnostic must retain source ownership`
    );
  }
}

const directSupportPolicy = compileUnknown({
  ...parsedHero.ir,
  support: { kind: 'base', contacts: ['head', 'head'] }
});
assert.equal(directSupportPolicy.ok, false);
if (!directSupportPolicy.ok) {
  for (const [code, path] of [
    ['intent.incompatible_domain_support', 'support.kind'],
    ['intent.invalid_support_cardinality', 'support.contacts.1'],
    ['intent.duplicate_support_contact', 'support.contacts.1']
  ] as const) {
    const issue: IntentProgramDiagnostic | undefined =
      directSupportPolicy.diagnostics.find(
      (entry) => entry.code === code
    );
    assert.deepEqual(
      issue?.span,
      resolveIntentProgramSourceSpan(parsedHero.sourceMap, path),
      `${code} must be owned by the shared resolver path`
    );
  }
}

const directHeroPolicy = compileUnknown({
  ...parsedHero.ir,
  focal: { id: 'beacon', parent: 'torso' }
});
assert.equal(directHeroPolicy.ok, false);
if (!directHeroPolicy.ok) assert.ok(directHeroPolicy.diagnostics.some(
  (entry) => entry.code === 'intent.hero_requires_one_focal_stage'
));

const directShapePolicy = compileUnknown({
  ...parsedHero.ir,
  surfaces: parsedHero.ir?.surfaces.map((surface) => ({
    ...surface,
    shape: {
      axis: 'vertical',
      span: 'medium',
      chord: 'medium',
      tip: 'rounded',
      offset: 'center',
      edge: 'convex'
    }
  }))
});
assert.equal(directShapePolicy.ok, false);
if (!directShapePolicy.ok) assert.ok(directShapePolicy.diagnostics.some(
  (entry) => entry.code === 'intent.surface_shape_axis_parallel'
));

const structuralAndSemantic = compileUnknown({
  ...parsedHero.ir,
  debug: true,
  body: parsedHero.ir?.body.map((module) => module.id === 'head'
    ? { ...module, cardinality: 'paired' }
    : module)
});
assert.equal(structuralAndSemantic.ok, false);
if (!structuralAndSemantic.ok) assert.deepEqual(
  new Set(structuralAndSemantic.diagnostics.map((entry) => entry.code)),
  new Set([
    'intent-program.unknown-normalized-property',
    'intent.invalid_body_attachment'
  ]),
  'safe structural findings must not suppress shared semantic diagnostics'
);
