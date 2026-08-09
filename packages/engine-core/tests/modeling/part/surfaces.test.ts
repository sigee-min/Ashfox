import assert from 'node:assert/strict';

import type { CubeFaceDirection } from '../../../src/model';
import type {
  SurfaceFaceOwnership,
  SurfaceOwnedCuboid
} from '../../../src/modeling/surface/ownership';
import {
  indexSurfaceCuboidsMeasured
} from '../../../src/modeling/part/surfaces';

const faces: Readonly<Record<CubeFaceDirection, SurfaceFaceOwnership>> = {
  north: 'external',
  south: 'external',
  east: 'external',
  west: 'external',
  up: 'external',
  down: 'external'
};
const cuboid = (ownerId: string, index: number): SurfaceOwnedCuboid => ({
  ownerId,
  cuboid: {
    bounds: {
      min: { x: index, y: 0, z: 0 },
      max: { x: index + 1, y: 1, z: 1 }
    }
  },
  faces
});

const count = 20_000;
const input = Array.from({ length: count }, (_, index) =>
  cuboid(index % 2 === 0 ? 'body' : 'detail', index)
);
const snapshot = JSON.stringify(input);
const first = indexSurfaceCuboidsMeasured(input);
const second = indexSurfaceCuboidsMeasured(input);

assert.deepEqual(second, first, 'surface indexing is deterministic');
assert.equal(JSON.stringify(input), snapshot, 'surface indexing does not mutate input');
assert.deepEqual(first.metric, {
  indexedCuboids: count,
  ownerArrays: 2
}, 'indexing allocates once per owner instead of once per cuboid');
assert.equal(first.cuboidsByOwner.get('body')?.length, count / 2);
assert.equal(first.cuboidsByOwner.get('detail')?.length, count / 2);
assert.equal(
  first.cuboidsByOwner.get('body')?.[100],
  input[200],
  'each owner retains exact source order and object identity'
);
