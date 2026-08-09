import assert from 'node:assert/strict';

import {
  canonicalizePartOccupancies,
  PART_OCCUPANCY_POLICY,
  type CanonicalizePartOccupanciesResult
} from '../../../src/modeling/occupancy';
import type { PartSpec } from '../../../src/modeling/part';

const plate = (
  partId: string,
  width: number,
  parentWidth?: number
): PartSpec => ({
  kind: 'plate',
  partId,
  parentPartId: parentWidth === undefined ? null : 'root',
  materialId: 'mat.base',
  joint: { kind: 'fixed' },
  attachment: parentWidth === undefined
    ? null
    : {
        parentAnchor: [parentWidth, 0, 0],
        partAnchor: [parentWidth, 0, 0]
      },
  plane: 'xy',
  origin: [0, 0, 0],
  outline: [
    [0, 0],
    [width, 0],
    [width, 1],
    [0, 1]
  ],
  thickness: 1
});

const overlapFixture = (rootWidth: number): readonly PartSpec[] => [
  plate('child', 5, rootWidth),
  plate('root', rootWidth)
];

assert.deepEqual(PART_OCCUPANCY_POLICY, {
  minimumRetainedNumerator: 1,
  minimumRetainedDenominator: 5,
  maximumAttachmentSnapDistanceBlocks: 2
});

const atLimit = overlapFixture(4);
const atLimitSnapshot = JSON.stringify(atLimit);
assert.deepEqual(canonicalizePartOccupancies(atLimit, 1), {
  ok: false,
  path: 'parts.child',
  message:
    'Part "child" retains only 20% of its authored cells after deterministic seam ownership. Move or resize it so more than 20% remains.'
});
assert.equal(JSON.stringify(atLimit), atLimitSnapshot);

const aboveLimit = overlapFixture(3);
const aboveLimitSnapshot = JSON.stringify(aboveLimit);
const canonical = canonicalizePartOccupancies(aboveLimit, 1);
const permuted = canonicalizePartOccupancies([...aboveLimit].reverse(), 1);
assert.deepEqual(permuted, canonical, 'equivalent order must be deterministic');
assert.equal(JSON.stringify(aboveLimit), aboveLimitSnapshot);
assert.equal(canonical.ok, true);
assert.equal(canonical.parts.length, 2);
const child = canonical.parts.find((part) => part.spec.partId === 'child');
assert.ok(child);
const retainedCellLimit =
  child.metric.authoredCellCount *
  PART_OCCUPANCY_POLICY.minimumRetainedNumerator /
  PART_OCCUPANCY_POLICY.minimumRetainedDenominator;
assert.equal(
  child.metric.canonicalCellCount,
  retainedCellLimit + 1,
  'one retained cell above the policy limit must remain valid'
);
assert.deepEqual(child.metric, {
  partId: 'child',
  authoredCellCount: 5,
  canonicalCellCount: 2,
  trimmedCellCount: 3,
  retainedFraction: 2 / 5,
  maximumTrimDepthCells: 3,
  canonicalAttachmentAnchor: [3, 0, 0],
  attachmentSnapDistanceCells: 0,
  trimmedByPartIds: ['root']
});
assert.deepEqual(child.cuboids, [{
  bounds: {
    min: { x: 3, y: 0, z: 0 },
    max: { x: 5, y: 1, z: 1 }
  }
}]);

const resultContract: CanonicalizePartOccupanciesResult = canonical;
assert.equal(resultContract.ok, true);
