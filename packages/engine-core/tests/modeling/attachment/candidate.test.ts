import assert from 'node:assert/strict';

import type { SurfacePixelDensity } from '../../../src/model';
import {
  bestAttachmentCandidate,
  bestAttachmentCandidateMeasured
} from '../../../src/modeling/attachment/candidates';
import type {
  LatticePoint,
  OccupancyGrid
} from '../../../src/modeling/contract';
import { createOccupancyGrid } from '../../../src/modeling/lattice';
import type { GeometryPartSpec } from '../../../src/modeling/part';
import { referenceAttachmentCandidate } from './reference';

const part = (
  partId: string,
  parentPartId: string | null
): GeometryPartSpec => ({
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

const child = part('child', 'parent');
const parent = part('parent', null);
const grid = (
  points: readonly LatticePoint[],
  density: SurfacePixelDensity = 1
): OccupancyGrid => createOccupancyGrid(density, points);

const parentCell = grid([{ x: 0, y: 0, z: 0 }]);
const intersection = bestAttachmentCandidate(
  child,
  parent,
  grid([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]),
  parentCell
);
assert.deepEqual(intersection, {
  offset: { x: 0, y: 0, z: 0 },
  anchor: { x: 1, y: 0, z: 0 },
  contactFaceCount: 1,
  retainedCellCount: 1
});
assert.equal(
  JSON.stringify(intersection),
  '{"offset":{"x":0,"y":0,"z":0},"anchor":{"x":1,"y":0,"z":0},"contactFaceCount":1,"retainedCellCount":1}',
  'candidate serialization order remains byte-stable'
);

assert.equal(bestAttachmentCandidate(
  child,
  parent,
  grid([{ x: 0, y: 0, z: 0 }]),
  parentCell
), null, 'complete containment never tries non-zero snap offsets');

assert.equal(bestAttachmentCandidate(
  child,
  parent,
  grid([
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 }
  ]),
  parentCell
), null, 'every retained connected component must contact the parent');

const tie = bestAttachmentCandidate(
  child,
  parent,
  grid([{ x: 2, y: 1, z: 0 }]),
  parentCell
);
assert.deepEqual(tie, {
  offset: { x: -2, y: 0, z: 0 },
  anchor: { x: 0, y: 1, z: 0 },
  contactFaceCount: 1,
  retainedCellCount: 1
}, 'equal candidates retain the established lexical offset tie-break');

const random = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
};

const randomGrid = (
  next: () => number,
  density: SurfacePixelDensity
): OccupancyGrid => {
  const count = 1 + next() % 12;
  return grid(Array.from({ length: count }, () => ({
    x: Number(next() % 11) - 5,
    y: Number(next() % 9) - 4,
    z: Number(next() % 7) - 3
  })), density);
};

for (let seed = 1; seed <= 80; seed += 1) {
  const next = random(seed);
  const density = [1, 2, 4][seed % 3] as SurfacePixelDensity;
  const authored = randomGrid(next, density);
  const parentOccupancy = randomGrid(next, density);
  const before = JSON.stringify({
    authored: [...authored.cells],
    parent: [...parentOccupancy.cells]
  });
  assert.deepEqual(
    bestAttachmentCandidate(child, parent, authored, parentOccupancy),
    referenceAttachmentCandidate(child, parent, authored, parentOccupancy),
    `optimized candidate parity seed ${seed}`
  );
  assert.equal(JSON.stringify({
    authored: [...authored.cells],
    parent: [...parentOccupancy.cells]
  }), before, `candidate input non-mutation seed ${seed}`);
}

const largePoints: LatticePoint[] = [];
for (let x = 0; x < 16; x += 1) {
  for (let y = 0; y < 8; y += 1) {
    for (let z = 0; z < 8; z += 1) largePoints.push({ x, y, z });
  }
}
const large = grid(largePoints, 4);
const maximum = bestAttachmentCandidateMeasured(
  child,
  parent,
  large,
  grid([{ x: 24, y: 0, z: 0 }], 4)
);
assert.deepEqual(maximum.candidate?.offset, { x: 8, y: 0, z: 0 });
assert.deepEqual(maximum.metric, {
  authoredCellParses: 1_024,
  parentCellParses: 1,
  offsetsEvaluated: 833,
  translatedCellEvaluations: 1_024,
  retainedGridAllocations: 1,
  componentGridAllocations: 1,
  candidatesAccepted: 1
});

const beyond = bestAttachmentCandidateMeasured(
  child,
  parent,
  large,
  grid([{ x: 25, y: 0, z: 0 }], 4)
);
assert.equal(beyond.candidate, null);
assert.deepEqual(beyond.metric, {
  authoredCellParses: 1_024,
  parentCellParses: 1,
  offsetsEvaluated: 833,
  translatedCellEvaluations: 0,
  retainedGridAllocations: 0,
  componentGridAllocations: 0,
  candidatesAccepted: 0
});
