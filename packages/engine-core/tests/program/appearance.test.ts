import assert from 'node:assert/strict';

import {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
  parseIntentProgram
} from '../../src/project/program';
import {
  PROJECT_APPEARANCE_SPECIFICATION
} from '../../src/project/appearance/contract';
import {
  normalizeProjectAppearanceIntent,
  type ProjectAppearanceIssue
} from '../../src/project/appearance/reader';

const appearanceLines = [
  'palette ocean',
  'texture mottle scale broad density balanced contrast subtle',
  'seed reef-17',
  'mark pale-belly target body torso region ventral placement whole as wash tone lighter scale broad density sparse contrast subtle',
  'mark gills target body head region posterior-flank placement center as bars tone darker flow vertical variant young-adult scale fine density sparse contrast medium',
  'mark fin-tips target surface fins region dorsal placement tip as patch tone accent scale medium density sparse contrast bold',
  'mark brow target face region dorsal placement center as band tone darker flow transverse scale fine density sparse contrast medium'
] as const;

const organismSource = (
  appearance: readonly string[] | null = appearanceLines
): string => [
  'metadata {',
  '  name "Reef Hound"',
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
  ...(appearance ? ['appearance {', ...appearance.map((line) => `  ${line}`), '}'] : [])
].join('\n');

const constructedSource = (
  appearance?: readonly string[]
): string => [
  'metadata {',
  '  name "Signal Cart"',
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
  ...(appearance ?? [
    'palette metal',
    'texture brushed scale medium density sparse contrast subtle',
    'seed auto'
  ]).map((line) => `  ${line}`),
  '}'
].join('\n');

const parsed = (source: string) => {
  const result = parseIntentProgram(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir);
  return result;
};

assert.equal(INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.specification.version, 1);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.regions, [
  'full', 'dorsal', 'ventral', 'flank', 'anterior', 'posterior',
  'dorsal-flank', 'ventral-flank', 'anterior-flank', 'posterior-flank'
]);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.placements, [
  'whole', 'center', 'root', 'tip', 'joint', 'edge'
]);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.flows, [
  'longitudinal', 'vertical', 'transverse', 'radial'
]);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.statements.mark, {
  keyword: 'mark',
  cardinality: { minimum: 0, maximum: 'maxMarkings' },
  identity: { field: 'id', unique: true },
  optional: ['flow', 'variant'],
  order: [
    'id', 'target', 'region', 'placement', 'motif', 'tone', 'flow',
    'variant', 'scale', 'density', 'contrast'
  ],
  markers: {
    target: 'target',
    region: 'region',
    placement: 'placement',
    motif: 'as',
    tone: 'tone',
    flow: 'flow',
    variant: 'variant',
    scale: 'scale',
    density: 'density',
    contrast: 'contrast'
  },
  values: {
    target: 'targets',
    region: 'regions',
    placement: 'placements',
    motif: 'motifs',
    tone: 'tones',
    flow: 'flows',
    scale: 'scales',
    density: 'densities',
    contrast: 'contrasts'
  },
  targetReferences: {
    body: { namespace: 'body', idCardinality: 1 },
    surface: { namespace: 'surfaces', idCardinality: 1 },
    face: { namespace: 'face', idCardinality: 0 },
    focal: { namespace: 'focal', idCardinality: 1 }
  },
  conditions: {
    flow: {
      allowedWhen: { motif: ['band', 'stripe', 'bars'] },
      forbiddenOtherwise: true,
      values: 'motifFlows'
    }
  }
});
assert.ok(Object.isFrozen(PROJECT_APPEARANCE_SPECIFICATION.statements));
assert.ok(Object.isFrozen(
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark.conditions.flow.allowedWhen
));
const maximumKey =
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark.cardinality.maximum;
assert.equal(PROJECT_APPEARANCE_SPECIFICATION[maximumKey], 32);
assert.equal(
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark.conditions.flow.values,
  'motifFlows'
);
const acceptedSource = organismSource();
const accepted = parsed(acceptedSource);
assert.deepEqual(accepted.ir?.appearance, {
  version: 1,
  palette: 'ocean',
  seed: { kind: 'explicit', value: 'reef-17' },
  texture: {
    kind: 'mottle',
    scale: 'broad',
    density: 'balanced',
    contrast: 'subtle'
  },
  markings: [
    {
      id: 'brow',
      target: { kind: 'face' },
      region: 'dorsal',
      placement: 'center',
      motif: 'band',
      tone: 'darker',
      flow: 'transverse',
      scale: 'fine',
      density: 'sparse',
      contrast: 'medium'
    },
    {
      id: 'fin-tips',
      target: { kind: 'surface', id: 'fins' },
      region: 'dorsal',
      placement: 'tip',
      motif: 'patch',
      tone: 'accent',
      scale: 'medium',
      density: 'sparse',
      contrast: 'bold'
    },
    {
      id: 'gills',
      target: { kind: 'body', id: 'head' },
      region: 'posterior-flank',
      placement: 'center',
      motif: 'bars',
      tone: 'darker',
      flow: 'vertical',
      variant: 'young-adult',
      scale: 'fine',
      density: 'sparse',
      contrast: 'medium'
    },
    {
      id: 'pale-belly',
      target: { kind: 'body', id: 'torso' },
      region: 'ventral',
      placement: 'whole',
      motif: 'wash',
      tone: 'lighter',
      scale: 'broad',
      density: 'sparse',
      contrast: 'subtle'
    }
  ]
});

const textureOffset = acceptedSource.indexOf('mottle');
assert.equal(
  accepted.sourceMap['appearance.palette']?.start.offset,
  acceptedSource.indexOf('ocean')
);
assert.equal(
  accepted.sourceMap['appearance.texture.kind']?.start.offset,
  textureOffset
);
const targetOffset = acceptedSource.indexOf('head region posterior-flank');
assert.equal(
  accepted.sourceMap['appearance.markings.gills.target.id']?.start.offset,
  targetOffset
);
assert.ok(accepted.ast.statements.some((statement) =>
  statement.keyword === 'mark' &&
  statement.fields.some((field) => field.path === 'appearance.markings.gills.flow')
), 'appearance declarations retain field-level AST ownership');

const missingAppearance = parseIntentProgram(organismSource(null));
assert.equal(missingAppearance.ir, null);
assert.ok(missingAppearance.diagnostics.some((entry) =>
  entry.code === 'intent.missing_authority_block'
), 'appearance is one mandatory source authority block');
assert.deepEqual(parsed(constructedSource()).ir?.appearance, {
  version: 1,
  palette: 'metal',
  seed: { kind: 'auto' },
  texture: {
    kind: 'brushed',
    scale: 'medium',
    density: 'sparse',
    contrast: 'subtle'
  },
  markings: []
});

const focal = parsed(constructedSource([
  'palette metal',
  'texture brushed scale medium density sparse contrast subtle',
  'seed auto',
  'mark signal target focal beacon region full placement center as patch tone accent scale medium density sparse contrast bold'
]));
assert.deepEqual(focal.ir?.appearance.markings[0]?.target, {
  kind: 'focal',
  id: 'beacon'
});

const partial = parseIntentProgram(organismSource([
  'texture mottle scale broad density balanced contrast subtle'
]));
assert.equal(partial.ir, null);
assert.ok(partial.diagnostics.some((entry) =>
  entry.code === 'intent.incomplete_appearance' ||
  entry.code === 'intent.missing_required'
), 'an authored block cannot inherit a hidden palette or seed');
assert.equal(
  partial.diagnostics.filter((entry) =>
    entry.code === 'intent.invalid_appearance' &&
    /seed|texture/i.test(entry.message)
  ).length,
  0,
  'missing required leaves produce only source-owned incomplete diagnostics'
);

const nonBlock = parseIntentProgram(
  organismSource(null).concat('\nappearance none')
);
assert.ok(nonBlock.diagnostics.some((entry) =>
  entry.code === 'intent.root_requires_block'
));

const duplicateLine = appearanceLines[3];
const duplicateSource = organismSource([
  appearanceLines[0],
  appearanceLines[1],
  appearanceLines[2],
  duplicateLine,
  duplicateLine
]);
const duplicate = parseIntentProgram(duplicateSource);
const duplicateDiagnostic = duplicate.diagnostics.find((entry) =>
  entry.code === 'intent.duplicate_appearance_mark'
);
assert.equal(
  duplicateDiagnostic?.span.start.offset,
  duplicateSource.lastIndexOf('pale-belly')
);

const duplicatePaletteSource = organismSource([
  ...appearanceLines,
  'palette ember'
]);
const duplicatePalette = parseIntentProgram(duplicatePaletteSource);
assert.equal(duplicatePalette.ir, null);
assert.equal(
  duplicatePalette.diagnostics.find((entry) =>
    entry.code === 'intent.duplicate_appearance_palette'
  )?.span.start.offset,
  duplicatePaletteSource.lastIndexOf('ember')
);

const aggregateLines = [
  appearanceLines[0],
  appearanceLines[1],
  appearanceLines[2],
  'mark absent target body missing region full placement whole as wash tone lighter scale broad density sparse contrast subtle',
  'mark face-errors target face region anterior placement root as wash tone darker flow radial scale medium density sparse contrast medium',
  'mark lost-light target focal beacon region full placement center as patch tone accent scale fine density sparse contrast bold',
  'mark line-one target body torso region full placement whole as stripe tone darker flow longitudinal scale fine density sparse contrast medium',
  'mark line-two target body torso region dorsal placement whole as bars tone lighter flow vertical scale fine density sparse contrast medium'
] as const;
const aggregateSource = organismSource(aggregateLines);
const aggregate = parseIntentProgram(aggregateSource);
const aggregateCodes = aggregate.diagnostics.map((entry) => entry.code);
assert.ok(aggregateCodes.includes('intent.unknown_appearance_target'));
assert.ok(aggregateCodes.includes('intent.invalid_appearance_region'));
assert.ok(aggregateCodes.includes('intent.invalid_appearance_placement'));
assert.ok(aggregateCodes.includes('intent.invalid_appearance_flow'));
assert.ok(aggregateCodes.includes('intent.ambiguous_appearance_overlap'));
assert.ok(aggregate.diagnostics.length >= 6, 'semantic appearance errors aggregate');
const offsets = aggregate.diagnostics.map((entry) => entry.span.start.offset);
assert.deepEqual(offsets, [...offsets].sort((left, right) => left - right));
const missingTarget = aggregate.diagnostics.find((entry) =>
  entry.code === 'intent.unknown_appearance_target' && entry.message.includes('body')
);
assert.equal(missingTarget?.span.start.offset, aggregateSource.indexOf('missing'));
const badRegion = aggregate.diagnostics.find((entry) =>
  entry.code === 'intent.invalid_appearance_region'
);
assert.equal(
  badRegion?.span.start.offset,
  aggregateSource.indexOf('anterior placement')
);
const badPlacement = aggregate.diagnostics.find((entry) =>
  entry.code === 'intent.invalid_appearance_placement'
);
assert.equal(
  badPlacement?.span.start.offset,
  aggregateSource.indexOf('root as wash')
);
const badFlow = aggregate.diagnostics.find((entry) =>
  entry.code === 'intent.invalid_appearance_flow'
);
assert.equal(badFlow?.span.start.offset, aggregateSource.indexOf('radial scale'));
const overlap = aggregate.diagnostics.find((entry) =>
  entry.code === 'intent.ambiguous_appearance_overlap'
);
assert.equal(overlap?.span.start.offset, aggregateSource.indexOf('line-two'));

const permuted = parsed(organismSource([
  appearanceLines[5],
  appearanceLines[2],
  appearanceLines[4],
  appearanceLines[0],
  appearanceLines[6],
  appearanceLines[3],
  appearanceLines[1]
]));
assert.equal(permuted.canonical, accepted.canonical);
assert.equal(permuted.hash, accepted.hash);
assert.deepEqual(permuted.ir?.appearance, accepted.ir?.appearance);

const partialTexture = parseIntentProgram(organismSource([
  'palette ocean',
  'texture mottle scale broad',
  'seed auto',
  'mark lost target body missing region full placement whole as wash tone darker scale broad density sparse contrast subtle'
]));
assert.ok(partialTexture.diagnostics.some((entry) =>
  entry.code === 'intent.invalid_appearance_texture'
), 'texture controls cannot escape the closed complete declaration');
assert.ok(partialTexture.diagnostics.some((entry) =>
  entry.code === 'intent.unknown_appearance_target'
), 'syntax and semantic diagnostics aggregate before the IR is rejected');
const partialOffsets = partialTexture.diagnostics.map((entry) => entry.span.start.offset);
assert.deepEqual(partialOffsets, [...partialOffsets].sort((left, right) => left - right));

const legacyVocabulary = parseIntentProgram(organismSource([
  appearanceLines[0],
  appearanceLines[1],
  appearanceLines[2],
  'mark legacy target body torso zone ventral anchor whole as wash tone lighter scale broad density sparse contrast subtle'
]));
assert.equal(legacyVocabulary.ir, null);
assert.ok(legacyVocabulary.diagnostics.some((entry) =>
  entry.code === 'intent.invalid_appearance_mark' &&
  entry.span.start.offset === legacyVocabulary.source.indexOf('zone')
), 'Surface Appearance V1 rejects the removed zone/anchor grammar');

const legacyTargetKeywordSource = organismSource([
  appearanceLines[0],
  appearanceLines[1],
  appearanceLines[2],
  'mark legacy-target on body torso region full placement whole as wash tone lighter scale broad density sparse contrast subtle'
]);
const legacyTargetKeyword = parseIntentProgram(legacyTargetKeywordSource);
assert.equal(legacyTargetKeyword.ir, null);
assert.ok(legacyTargetKeyword.diagnostics.some((entry) =>
  entry.code === 'intent.invalid_appearance_mark' &&
  entry.span.start.offset === legacyTargetKeywordSource.indexOf(' on body') + 1
), 'mark target is required; the removed on keyword has no alias');

const reorderedMarkSource = organismSource([
  appearanceLines[0],
  appearanceLines[1],
  appearanceLines[2],
  'mark reordered target body torso placement whole region full as wash tone lighter scale broad density sparse contrast subtle'
]);
const reorderedMark = parseIntentProgram(reorderedMarkSource);
assert.equal(reorderedMark.ir, null);
assert.ok(reorderedMark.diagnostics.some((entry) =>
  entry.code === 'intent.invalid_appearance_mark' &&
  entry.span.start.offset === reorderedMarkSource.indexOf('placement whole')
), 'mark clauses use one strict statement schema and order');

for (const legacyLine of [
  'mark legacy-region target body torso region lateral placement whole as wash tone lighter scale broad density sparse contrast subtle',
  'mark legacy-flow target body torso region full placement whole as band tone darker flow lateral scale broad density sparse contrast subtle'
]) {
  const legacyValueSource = organismSource([
    appearanceLines[0],
    appearanceLines[1],
    appearanceLines[2],
    legacyLine
  ]);
  const legacyValue = parseIntentProgram(legacyValueSource);
  assert.equal(legacyValue.ir, null);
  assert.ok(legacyValue.diagnostics.some((entry) =>
    entry.code === 'intent.invalid_appearance_mark' &&
    entry.span.start.offset === legacyValueSource.lastIndexOf('lateral')
  ), `Surface Appearance V1 rejects legacy vocabulary in: ${legacyLine}`);
}

const legacyObjectIssues: ProjectAppearanceIssue[] = [];
const legacyObject = normalizeProjectAppearanceIntent({
  version: 1,
  seed: { kind: 'auto' },
  texture: {
    kind: 'mottle',
    scale: 'broad',
    density: 'balanced',
    contrast: 'subtle'
  },
  markings: [{
    id: 'legacy',
    target: { kind: 'body', id: 'torso' },
    zone: 'ventral',
    anchor: 'whole',
    motif: 'wash',
    tone: 'lighter',
    scale: 'broad',
    density: 'sparse',
    contrast: 'subtle'
  }]
}, legacyObjectIssues);
assert.equal(legacyObject, null);
assert.deepEqual(
  legacyObjectIssues.filter((issue) =>
    issue.path.endsWith('.zone') || issue.path.endsWith('.anchor')
  ).map((issue) => issue.message),
  ['Unknown appearance property.', 'Unknown appearance property.']
);
