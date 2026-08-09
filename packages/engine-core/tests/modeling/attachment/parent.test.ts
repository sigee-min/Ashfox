import assert from 'node:assert/strict';

import type { SurfacePixelDensity } from '../../../src/model';
import {
  inferFixedPartParents
} from '../../../src/modeling/attachment/derive';
import {
  inferFixedPartParentsMeasured,
  type ParentCandidateSelector
} from '../../../src/modeling/attachment/parent';
import type {
  GeometryPartSpec,
  PartSpec
} from '../../../src/modeling/part';

const mass = (
  partId: string,
  center: readonly [number, number, number],
  parentPartId: string | null = null
): GeometryPartSpec => ({
  kind: 'mass',
  partId,
  parentPartId,
  materialId: 'mat.base',
  joint: { kind: 'fixed' },
  attachment: null,
  center,
  radii: [1, 1, 1],
  profile: 'block'
});

const exhaustiveCandidates: ParentCandidateSelector = (
  _part,
  geometryParts
) => geometryParts;

const parity = (
  parts: readonly PartSpec[],
  omitted: ReadonlySet<string>,
  density: SurfacePixelDensity
) => {
  const before = JSON.stringify({ parts, omitted: [...omitted] });
  const broad = inferFixedPartParentsMeasured(parts, omitted, density);
  const reference = inferFixedPartParentsMeasured(parts, omitted, density, {
    selectCandidates: exhaustiveCandidates
  });
  assert.deepEqual(broad.result, reference.result);
  assert.deepEqual(inferFixedPartParents(parts, omitted, density), broad.result);
  assert.equal(JSON.stringify({ parts, omitted: [...omitted] }), before);
  assert.ok(
    broad.metric.candidateEvaluations <= reference.metric.candidateEvaluations
  );
  return { broad, reference };
};

const inferredParent = (
  center: readonly [number, number, number],
  density: SurfacePixelDensity = 1
) => parity([
  mass('root', [0, 0, 0]),
  mass('child', center)
], new Set(['child']), density);

for (const [label, center, density] of [
  ['overlap', [1, 0, 0], 1],
  ['touching', [2, 0, 0], 1],
  ['diagonal snap', [2, 2, 0], 1],
  ['maximum snap', [4, 0, 0], 1],
  ['density-scaled maximum snap', [6, 0, 0], 2]
] as const) {
  const evaluation = inferredParent(center, density);
  assert.equal(evaluation.broad.result.ok, true, label);
  if (evaluation.broad.result.ok) {
    assert.equal(
      evaluation.broad.result.parts.find((part) => part.partId === 'child')
        ?.parentPartId,
      'root',
      label
    );
  }
  assert.equal(evaluation.broad.metric.candidateEvaluations, 1, label);
}

for (const [center, density] of [
  [[5, 0, 0], 1],
  [[7, 0, 0], 2]
] as const) {
  const beyond = inferredParent(center, density);
  assert.equal(beyond.broad.result.ok, false);
  assert.equal(beyond.broad.metric.candidateEvaluations, 0);
  assert.equal(beyond.reference.metric.candidateEvaluations, 1);
}

const multiple = parity([
  mass('parent-z', [-2, 0, 0]),
  mass('parent-a', [2, 0, 0]),
  mass('child', [0, 0, 0])
], new Set(['child']), 1).broad.result;
assert.deepEqual(multiple, {
  ok: false,
  partId: 'child',
  message:
    'Part "child" touches multiple possible parents (parent-a, parent-z). Provide parentPartId explicitly.'
});

const absent = parity([
  mass('root', [0, 0, 0]),
  mass('orphan', [50, 0, 0])
], new Set(['orphan']), 1).broad.result;
assert.deepEqual(absent, {
  ok: false,
  partId: 'orphan',
  message:
    'Part "orphan" has no unique contact parent. Provide parentPartId explicitly.'
});

const descendant = parity([
  mass('root', [50, 0, 0]),
  mass('branch', [0, 0, 0]),
  mass('leaf', [2, 0, 0], 'branch')
], new Set(['branch']), 1).broad.result;
assert.deepEqual(descendant, {
  ok: false,
  partId: 'branch',
  message:
    'Part "branch" has no unique contact parent. Provide parentPartId explicitly.'
});

const cycle = parity([
  mass('root', [100, 0, 0]),
  mass('b', [2, 0, 0]),
  mass('a', [0, 0, 0])
], new Set(['a', 'b']), 1).broad.result;
assert.deepEqual(cycle, {
  ok: false,
  partId: 'a',
  message:
    'Geometric parent inference would create a cyclic hierarchy. Provide parentPartId explicitly.'
});

const noExplicitRoot = parity([
  mass('b', [2, 0, 0]),
  mass('a', [0, 0, 0])
], new Set(['a', 'b']), 1).broad.result;
assert.deepEqual(noExplicitRoot, {
  ok: false,
  partId: 'a',
  message:
    'A multi-part model requires one explicit root with parentPartId: null before omitted fixed parents can be inferred.'
});

const random = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
};

for (let seed = 1; seed <= 40; seed += 1) {
  const next = random(seed);
  const parts = Array.from({ length: 12 }, (_, index) => {
    const parentPartId = index > 0 && next() % 5 === 0
      ? 'part-00'
      : null;
    return mass(
      `part-${index.toString().padStart(2, '0')}`,
      [
        Number(next() % 25) - 12,
        Number(next() % 11) - 5,
        Number(next() % 7) - 3
      ],
      parentPartId
    );
  });
  const omitted = new Set(parts.slice(1).flatMap((part) =>
    next() % 3 === 0 ? [] : [part.partId]
  ));
  if (omitted.size === 0) omitted.add(parts[1]!.partId);
  const result = parity(parts, omitted, 1);
  assert.deepEqual(
    result.broad.result,
    result.reference.result,
    `random broad-phase parity seed ${seed}`
  );
}

const stressParts: PartSpec[] = [];
const stressOmitted = new Set<string>();
for (let index = 0; index < 512; index += 1) {
  const prefix = index.toString().padStart(4, '0');
  const origin = index * 20;
  stressParts.push(mass(`parent-${prefix}`, [origin, 0, 0]));
  stressParts.push(mass(`child-${prefix}`, [origin + 2, 0, 0]));
  stressOmitted.add(`child-${prefix}`);
}
const stress = inferFixedPartParentsMeasured(
  stressParts,
  stressOmitted,
  1
);
assert.equal(stress.result.ok, true);
assert.equal(stressParts.length, 1_024);
assert.equal(stress.metric.candidateEvaluations, 512);
assert.equal(stress.metric.candidateSelections, 1_024);
assert.ok(
  stress.metric.candidateEvaluations < stressParts.length * 2,
  'sparse exact candidate evaluation grows linearly, not quadratically'
);
assert.ok(
  stress.metric.candidateSelections < stressParts.length * 2,
  'sparse broad-phase parent lookup grows linearly, not quadratically'
);
