import assert from 'node:assert/strict';

import type { AuthoringProfileIssue } from '../../../../src/authoring/profile/evidence';
import {
  readAuthoringSlotSpan
} from '../../../../src/authoring/profile/slots/span';

const partIds = [
  'wing.root',
  'wing.spar.lower',
  'wing.spar.upper',
  'wing.membrane.main'
];

const rawSpan = (reverse = false) => ({
  kind: 'supported-surface',
  obligationId: 'surface.primary',
  rootPartIds: ['wing.root'],
  spars: (reverse ? [{
    sparId: 'upper',
    partIds: ['wing.spar.upper']
  }, {
    sparId: 'lower',
    partIds: ['wing.spar.lower']
  }] : [{
    sparId: 'lower',
    partIds: ['wing.spar.lower']
  }, {
    sparId: 'upper',
    partIds: ['wing.spar.upper']
  }]),
  membranes: [{
    membraneId: 'main',
    partIds: ['wing.membrane.main'],
    boundedBySparIds: reverse
      ? ['upper', 'lower']
      : ['lower', 'upper']
  }]
});

const read = (
  value: unknown,
  role: 'span' | 'accent' = 'span',
  owned: readonly string[] = partIds
) => {
  const issues: AuthoringProfileIssue[] = [];
  const span = readAuthoringSlotSpan(
    value,
    'slots[0].span',
    role,
    owned,
    issues
  );
  return { span, issues };
};

const canonical = read(rawSpan());
assert.ok(canonical.span);
assert.deepEqual(canonical.issues, []);
assert.deepEqual(
  read(rawSpan(true)),
  canonical,
  'span semantic arrays must normalize independently of input order'
);

assert.equal(read({ kind: 'none' }).span, null);
assert.equal(read(rawSpan(), 'accent').span, null);
assert.deepEqual(read({ kind: 'none' }, 'accent'), {
  span: { kind: 'none' },
  issues: []
});

const extraKey = read({ ...rawSpan(), legacy: true });
assert.equal(extraKey.span, null);
assert.ok(extraKey.issues.some((issue) =>
  issue.path === 'slots[0].span'
));

const unclassified = read(rawSpan(), 'span', [
  ...partIds,
  'wing.unclassified'
]);
assert.equal(unclassified.span, null);
assert.match(unclassified.issues.at(-1)?.message ?? '', /exhaust/u);

const duplicated = rawSpan();
duplicated.membranes[0].partIds = ['wing.spar.lower'];
assert.equal(read(duplicated).span, null);

const wrongBoundary = rawSpan();
wrongBoundary.membranes[0].boundedBySparIds = ['lower', 'missing'];
const wrongBoundaryResult = read(wrongBoundary);
assert.equal(wrongBoundaryResult.span, null);
assert.ok(wrongBoundaryResult.issues.some((issue) =>
  issue.path.endsWith('.boundedBySparIds')
));
