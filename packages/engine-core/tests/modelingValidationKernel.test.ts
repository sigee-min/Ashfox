import assert from 'node:assert/strict';

import {
  componentCellKeys,
  findSixConnectedComponents,
  isSixConnected
} from '../src/modeling/connectivity';
import {
  createOccupancyGrid,
  latticeToWorld,
  stableBoundsKey,
  worldToLattice
} from '../src/modeling/lattice';
import type { SurfacePixelDensity } from '../src/model';

assert.equal(worldToLattice(0.5, 2), 1);
assert.equal(worldToLattice(-0.25, 4), -1);
assert.equal(latticeToWorld(3, 4), 0.75);
assert.throws(() => worldToLattice(0.5, 1), /not aligned/);
assert.throws(
  () => createOccupancyGrid(3 as SurfacePixelDensity, []),
  /density/
);
assert.notEqual(
  stableBoundsKey(1, {
    min: { x: -1, y: 0, z: 2 },
    max: { x: 3, y: 4, z: 5 }
  }),
  stableBoundsKey(2, {
    min: { x: -1, y: 0, z: 2 },
    max: { x: 3, y: 4, z: 5 }
  })
);

const connected = createOccupancyGrid(1, [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 }
]);
assert.equal(isSixConnected(connected), true);

const disconnected = createOccupancyGrid(1, [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 }
]);
const components = findSixConnectedComponents(disconnected);
assert.equal(components.length, 2);
assert.deepEqual(componentCellKeys(components[0]), ['0,0,0', '1,0,0']);
assert.deepEqual(componentCellKeys(components[1]), ['5,0,0']);
assert.equal(isSixConnected(disconnected), false);
assert.equal(isSixConnected(createOccupancyGrid(1, [])), false);
