import assert from 'node:assert/strict';

import { compileIntentProgram } from '../src/compiler/intentProgram';
import {
  parseIntentProgram,
  resolveIntentProgramSourceSpan
} from '../src/project/intentProgram';
import type { IntentProgramIr } from '../src/project/intentProgramTypes';

const hasCode = (source: string, code: string): boolean =>
  parseIntentProgram(source).diagnostics.some((diagnostic) => diagnostic.code === code);

const heroFaceSource = [
  'asset "Lantern Hound"',
  'track hero',
  'domain organism',
  'frame front north',
  'symmetry bilateral',
  'rest neutral feet on legs',
  'body core torso',
  'body mass head from torso extends forward',
  'body limb legs pair from torso extends down',
  'surface wings pair fin from torso extends up',
  'face full on head',
  'eyes pair gaze center',
  'nose present',
  'mouth neutral',
  'motion idle breathe',
  'style palette ember'
].join('\n');

const parsedHero = parseIntentProgram(heroFaceSource);
assert.equal(parsedHero.diagnostics.length, 0);
assert.ok(parsedHero.ir);
assert.deepEqual(parsedHero.ir?.body.find((module) => module.id === 'head'), {
  id: 'head',
  kind: 'mass',
  from: 'torso',
  extension: 'forward',
  modifiers: []
});
assert.equal(parsedHero.ir?.face.on, 'head');
assert.deepEqual(parsedHero.ir?.motion, { kind: 'idle', mode: 'breathe' });
assert.equal(parsedHero.sourceMap['body.head.from']?.start.line, 8);
assert.equal(parsedHero.sourceMap['body.head.extension']?.start.line, 8);
assert.equal(parsedHero.sourceMap['surfaces.wings.from']?.start.line, 10);
assert.equal(parsedHero.sourceMap['face.on']?.start.line, 11);
assert.equal(
  resolveIntentProgramSourceSpan(parsedHero.sourceMap, 'body.head.port.front')?.start.line,
  8,
  'compiler subpaths must inherit their nearest source declaration'
);
assert.ok(
  parsedHero.ast.statements.some((statement) =>
    statement.fields.some((field) => field.path === 'face.on' && field.span.start.line === 11)
  ),
  'AST must retain field-level token ownership'
);

const heroFocalSource = [
  'asset "Courier"',
  'track hero',
  'domain constructed',
  'frame front north',
  'symmetry bilateral',
  'rest neutral wheels on wheels',
  'body core chassis',
  'body wheel wheels pair from chassis extends down',
  'face none',
  'focal beacon on chassis',
  'motion idle scan',
  'style palette metal'
].join('\n');

const parsedFocal = parseIntentProgram(heroFocalSource);
assert.equal(parsedFocal.diagnostics.length, 0);
assert.deepEqual(parsedFocal.ir?.focal, { id: 'beacon', on: 'chassis' });
assert.deepEqual(parsedFocal.ir?.rest, { kind: 'wheels', on: 'wheels' });

assert.equal(hasCode('asset "unterminated', 'intent.unclosed_string'), true);
assert.equal(hasCode('asset "bad\\q"', 'intent.invalid_escape'), true);
assert.equal(hasCode('asset Lantern', 'intent.asset_requires_quoted_string'), true);
assert.equal(
  hasCode(heroFaceSource.replace('body limb legs pair', 'body limb legs paired'), 'intent.invalid_body_relation'),
  true,
  '`paired` is not a source-language spelling'
);
assert.equal(
  hasCode(heroFaceSource.replace('pair fin', 'pair membrane'), 'intent.invalid_surface'),
  true,
  '`membrane` is not a surface-role alias'
);
assert.equal(
  hasCode(heroFaceSource.replace('rest neutral feet on legs', 'rest feet on legs'), 'intent.invalid_rest'),
  true,
  'rest shortcuts are not accepted'
);
assert.equal(
  hasCode(heroFaceSource.replace('surface wings pair fin from torso extends up', 'surface wings single fin from torso extends lateral'), 'intent.invalid_surface_direction'),
  true,
  'single lateral surfaces fail in the grammar, before lowering'
);
assert.equal(
  hasCode(heroFaceSource.replace('surface wings pair fin from torso extends up', 'surface wing single fin from torso extends left'), 'intent.single_sided_surface_requires_asymmetric'),
  true,
  'a bilateral source cannot hide a single-sided surface'
);
assert.equal(
  hasCode(heroFaceSource.replace('body core torso', 'body core "Main Body"'), 'intent.invalid_identifier'),
  true,
  'invalid emitted IDs must fail in the source grammar'
);
assert.equal(
  hasCode(heroFaceSource.replace('face full on head', 'face full'), 'intent.invalid_face'),
  true,
  'a full face must name its body host'
);
assert.equal(
  hasCode(heroFaceSource.replace('motion idle breathe\n', ''), 'intent.missing_required'),
  true,
  'canonical idle motion cannot be implicit'
);
assert.equal(
  hasCode(heroFaceSource.replace('style palette ember', ''), 'intent.missing_required'),
  true,
  'palette cannot be an implicit compiler default'
);
assert.equal(
  hasCode(
    heroFaceSource
      .replace('face full on head\n', 'face none\n')
      .replace('eyes pair gaze center\n', '')
      .replace('nose present\n', '')
      .replace('mouth neutral\n', ''),
    'intent.hero_requires_one_focal_stage'
  ),
  true,
  'hero declarations need an explicit face or focal stage'
);
assert.equal(
  hasCode(heroFocalSource.replace('face none', 'face full on chassis\neyes pair gaze center\nnose present\nmouth neutral'), 'intent.hero_requires_one_focal_stage'),
  true,
  'hero declarations cannot use both face and focal stages'
);
assert.equal(
  hasCode(heroFocalSource.replace('track hero', 'track essential'), 'intent.focal_requires_hero_track'),
  true,
  'focal is reserved for the hero track'
);

const compilerResult = compileIntentProgram({
  program: {
    ...parsedHero.ir!,
    style: {}
  } as unknown as IntentProgramIr,
  sourceMap: parsedHero.sourceMap
});
assert.equal(compilerResult.ok, false);
if (!compilerResult.ok) {
  assert.ok(
    compilerResult.diagnostics.some((diagnostic) =>
      diagnostic.code === 'intent-program.invalid-normalized-palette'
    ),
    'the public compiler rejects omitted palette data instead of applying a fallback'
  );
}

const incompleteFaceResult = compileIntentProgram({
  program: {
    ...parsedHero.ir!,
    face: { kind: 'full', on: 'head', eyes: 'paired' }
  } as unknown as IntentProgramIr,
  sourceMap: parsedHero.sourceMap
});
assert.equal(incompleteFaceResult.ok, false);
if (!incompleteFaceResult.ok) {
  assert.ok(
    incompleteFaceResult.diagnostics.some((diagnostic) =>
      diagnostic.code === 'intent-program.incomplete-normalized-face'
    ),
    'the public compiler rejects partial face IR before lowering'
  );
}
