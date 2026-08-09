import assert from 'node:assert/strict';

import {
  canonicalizePartOccupancies as publicCanonicalize
} from '../../../src';
import {
  canonicalizePartOccupancies,
  canonicalPartOrder
} from '../../../src/modeling/occupancy';
import {
  PART_CONTRACT_LIMITS,
  type PartSpec
} from '../../../src/modeling/part';
import { compareStableText } from '../../../src/stableOrder';

const mass = (
  partId: string,
  parentPartId: string | null = null
): PartSpec => ({
  kind: 'mass',
  partId,
  parentPartId,
  materialId: 'mat.base',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [0, 0, 0],
  radii: [1, 1, 1],
  profile: 'block'
});

const referenceOrder = (
  parts: readonly PartSpec[]
): readonly PartSpec[] | null => {
  const remaining = new Map(
    parts.map((part) => [part.partId, part] as const)
  );
  if (remaining.size !== parts.length) return null;
  const resolved = new Set<string>();
  const ordered: PartSpec[] = [];
  while (remaining.size > 0) {
    const next = [...remaining.values()]
      .filter((part) =>
        part.parentPartId === null || resolved.has(part.parentPartId)
      )
      .sort((left, right) =>
        compareStableText(left.partId, right.partId)
      )[0];
    if (!next) return null;
    ordered.push(next);
    remaining.delete(next.partId);
    resolved.add(next.partId);
  }
  return ordered;
};

assert.equal(publicCanonicalize, canonicalizePartOccupancies);

const graph = [
  mass('root.z'),
  mass('child.b', 'root.z'),
  mass('root.a'),
  mass('child.c', 'root.a'),
  mass('child.aa', 'child.b')
];
const graphSnapshot = JSON.stringify(graph);
for (const permutation of [graph, [...graph].reverse()]) {
  const expected = referenceOrder(permutation);
  const actual = canonicalPartOrder(permutation);
  assert.deepEqual(
    actual?.map((part) => part.partId),
    expected?.map((part) => part.partId)
  );
}
assert.equal(JSON.stringify(graph), graphSnapshot, 'ordering cannot mutate input');

const malformed = [[
  mass('duplicate'),
  mass('duplicate')
], [
  mass('orphan', 'missing')
], [
  mass('cycle.a', 'cycle.b'),
  mass('cycle.b', 'cycle.a')
]] as const;
for (const aggregate of malformed) {
  assert.equal(canonicalPartOrder(aggregate), null);
  assert.deepEqual(canonicalizePartOccupancies(aggregate, 1), {
    ok: false,
    path: 'parts',
    message:
      'Part hierarchy must contain unique IDs, existing parents, and no cycles.'
  });
}

const largeCount = PART_CONTRACT_LIMITS.maxPartsPerDocument;
const large = [
  ...Array.from({ length: largeCount - 1 }, (_, index) =>
    mass(`node.${String(index).padStart(4, '0')}`, 'root')
  ).reverse(),
  mass('root')
];
const largeSnapshot = JSON.stringify(large);
const largeOrdered = canonicalPartOrder(large);
assert.equal(largeOrdered?.length, largeCount);
assert.equal(largeOrdered?.[0]?.partId, 'root');
assert.deepEqual(
  largeOrdered?.slice(1).map((part) => part.partId),
  [...large.slice(0, -1)]
    .map((part) => part.partId)
    .sort(compareStableText)
);
assert.equal(
  JSON.stringify(large),
  largeSnapshot,
  'the maximum document-sized hierarchy cannot be mutated'
);
