import assert from 'node:assert/strict';

import {
  PROJECT_INTENT_LIMITS,
  PROJECT_REFERENCE_ID_PATTERN_SOURCE,
  normalizeProjectIntent,
  projectIntentReader,
  projectIntentsEqual,
  readProjectIntent,
  type NormalizeProjectIntentResult,
  type ProjectIntentReader
} from '../../src/project/intent';

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const semanticContract = {
  subjectDomain: 'constructed',
  canonicalSupport: { kind: 'supported-base' },
  face: { kind: 'none' },
  supportedSurfaces: []
} as const;

const source = deepFreeze({
  subject: '  Glider   unit ',
  forward: 'north',
  grounding: 'grounded',
  symmetry: { kind: 'asymmetric', pairPlaneTwice: -0 },
  semanticContract,
  features: ['  beta  cue', 'alpha cue', 'beta cue'],
  references: [{
    id: 'ref-b',
    kind: 'text',
    description: '  Second   reference ',
    cues: ['zeta', ' alpha ']
  }, {
    id: 'ref-a',
    kind: 'image',
    description: 'First reference',
    cues: ['beta', 'alpha', 'beta'],
    contentHash: '  sha256:abc  '
  }]
});
const snapshot = JSON.stringify(source);
const normalized: NormalizeProjectIntentResult = normalizeProjectIntent(source);
if (!normalized.ok) throw new Error(normalized.issues[0]?.message);
assert.equal(normalized.ok, true);
assert.equal(JSON.stringify(source), snapshot, 'normalization must not mutate input');
assert.deepEqual(normalized.intent, {
  subject: 'Glider unit',
  forward: 'north',
  grounding: 'grounded',
  symmetry: { kind: 'asymmetric', pairPlaneTwice: 0 },
  semanticContract,
  features: ['alpha cue', 'beta cue'],
  references: [{
    id: 'ref-a',
    kind: 'image',
    description: 'First reference',
    cues: ['alpha', 'beta'],
    contentHash: 'sha256:abc'
  }, {
    id: 'ref-b',
    kind: 'text',
    description: 'Second reference',
    cues: ['alpha', 'zeta']
  }]
});
assert.equal(Object.is(normalized.intent.symmetry.kind === 'asymmetric'
  ? normalized.intent.symmetry.pairPlaneTwice
  : undefined, -0), false);

const permuted = normalizeProjectIntent({
  ...source,
  features: [...source.features].reverse(),
  references: [...source.references].reverse().map((reference) => ({
    ...reference,
    cues: [...reference.cues].reverse()
  }))
});
if (!permuted.ok) throw new Error(permuted.issues[0]?.message);
assert.equal(permuted.ok, true);
assert.deepEqual(permuted.intent, normalized.intent);
assert.equal(projectIntentsEqual(permuted.intent, normalized.intent), true);
assert.equal(projectIntentsEqual(normalized.intent, normalized.intent), true);
assert.equal(projectIntentsEqual(normalized.intent, undefined), false);

const reader: ProjectIntentReader = projectIntentReader;
assert.equal(reader.normalize, normalizeProjectIntent);
assert.equal(reader.read, readProjectIntent);
const persisted = readProjectIntent({ intent: normalized.intent });
assert.equal(persisted.ok, true);
assert.deepEqual(persisted.ok ? persisted.intent : null, normalized.intent);
const nonCanonical = readProjectIntent({ intent: source as never });
assert.deepEqual(nonCanonical, {
  ok: false,
  issues: [{
    path: 'intent',
    message:
      'Persisted project intent must use normalized text and stable ordering.',
    expected: 'normalized project intent'
  }]
});

const invalid = deepFreeze({
  zUnknown: true,
  aUnknown: true,
  subject: ' ',
  forward: 'diagonal',
  grounding: 'submerged',
  symmetry: { kind: 'bilateral', planeTwice: 'bad', mystery: true },
  semanticContract: {},
  features: [' ', 42],
  references: [{
    id: 'BAD ID',
    kind: 'video',
    description: ' ',
    cues: [' ', 7],
    extra: true
  }, 'bad'],
  appearanceBindings: []
});
const firstInvalid = normalizeProjectIntent(invalid);
const secondInvalid = normalizeProjectIntent(invalid);
assert.equal(firstInvalid.ok, false);
assert.deepEqual(secondInvalid, firstInvalid, 'diagnostics must be deterministic');
if (firstInvalid.ok) throw new Error('invalid fixture unexpectedly normalized');
assert.equal(Object.isFrozen(firstInvalid), true);
assert.equal(Object.isFrozen(firstInvalid.issues), true);
assert.equal(Object.isFrozen(firstInvalid.issues[0]), true);
assert.equal(Object.isFrozen(firstInvalid.issues.at(-1)), true);
assert.deepEqual(firstInvalid.issues.map((issue) => issue.path), [
  'zUnknown',
  'aUnknown',
  'subject',
  'forward',
  'grounding',
  'symmetry.mystery',
  'symmetry.planeTwice',
  'features[0]',
  'features[1]',
  'references[0].extra',
  'references[0].id',
  'references[0].kind',
  'references[0].description',
  'references[0].cues[0]',
  'references[0].cues[1]',
  'references[1]',
  'semanticContract',
  'appearanceBindings'
]);

assert.deepEqual(normalizeProjectIntent(null), {
  ok: false,
  issues: [{
    path: 'intent',
    message: 'Project intent must be an object.',
    expected: 'project intent object'
  }]
});
assert.equal(PROJECT_INTENT_LIMITS.maxReferences, 16);
assert.equal(new RegExp(PROJECT_REFERENCE_ID_PATTERN_SOURCE).test('ref-a'), true);
