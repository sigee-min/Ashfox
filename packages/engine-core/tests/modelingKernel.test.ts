import assert from 'node:assert/strict';

import {
  componentCellKeys,
  findSixConnectedComponents,
  isSixConnected
} from '../src/modeling/connectivity';
import {
  assertExactDecomposition,
  decomposeOccupancy,
  decomposeWithAxisOrder,
  GREEDY_AXIS_ORDERS
} from '../src/modeling/decompose';
import {
  createOccupancyGrid,
  latticeToWorld,
  sortCells,
  stableBoundsKey,
  worldToLattice
} from '../src/modeling/lattice';
import { rasterizeMass } from '../src/modeling/mass';
import { rasterizePlate } from '../src/modeling/plate';
import { rasterizePrimitive } from '../src/modeling/rasterize';
import { rasterizeRadial } from '../src/modeling/radial';
import { rasterizeSegment } from '../src/modeling/segment';
import type { SurfacePixelDensity } from '../src/model';
import type {
  CuboidDecomposition,
  LatticePoint,
  OccupancyGrid
} from '../src/modeling/types';

const serializedCells = (grid: OccupancyGrid): string =>
  JSON.stringify(sortCells(grid.cells));

const serializedDecomposition = (
  decomposition: CuboidDecomposition
): string => JSON.stringify(decomposition);

const compareScores = (
  left: CuboidDecomposition,
  right: CuboidDecomposition
): number =>
  left.score.boxCount - right.score.boxCount ||
  left.score.internalSeamArea - right.score.internalSeamArea ||
  left.score.aspectPenalty - right.score.aspectPenalty ||
  (left.score.lexicalSignature < right.score.lexicalSignature
    ? -1
    : left.score.lexicalSignature > right.score.lexicalSignature
      ? 1
      : 0);

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

const softMass = rasterizeMass(2, {
  kind: 'mass',
  center: { x: 0, y: 0, z: 0 },
  radii: { x: 4, y: 3, z: 2 },
  profile: 'soft'
});
const hardMass = rasterizeMass(2, {
  kind: 'mass',
  center: { x: 0, y: 0, z: 0 },
  radii: { x: 4, y: 3, z: 2 },
  profile: 'hard'
});
assert.ok(softMass.cells.size > 0);
assert.ok(hardMass.cells.size >= softMass.cells.size);
assert.equal(
  serializedCells(softMass),
  serializedCells(
    rasterizePrimitive(2, {
      kind: 'mass',
      center: { x: 0, y: 0, z: 0 },
      radii: { x: 4, y: 3, z: 2 },
      profile: 'soft'
    })
  )
);
for (const cell of sortCells(softMass.cells)) {
  assert.ok(
    softMass.cells.has(`${-cell.x - 1},${-cell.y - 1},${-cell.z - 1}`)
  );
}

const sweptSegment = rasterizeSegment(4, {
  kind: 'segment',
  profile: 'balanced',
  points: [
    {
      position: { x: -4, y: 0, z: 0 },
      radii: { x: 2, y: 2, z: 2 }
    },
    {
      position: { x: 0, y: 2, z: 0 },
      radii: { x: 2, y: 3, z: 2 }
    },
    {
      position: { x: 4, y: 0, z: 0 },
      radii: { x: 2, y: 2, z: 2 }
    }
  ]
});
assert.ok(sweptSegment.cells.size > 0);
assert.ok(isSixConnected(sweptSegment));
assert.throws(
  () =>
    rasterizeSegment(1, {
      kind: 'segment',
      profile: 'soft',
      points: Array.from({ length: 9 }, (_, index) => ({
        position: { x: index, y: 0, z: 0 },
        radii: { x: 1, y: 1, z: 1 }
      }))
    }),
  /between 2 and 8/
);
assert.throws(
  () =>
    rasterizeSegment(1, {
      kind: 'segment',
      profile: 'soft',
      points: [
        {
          position: { x: 0, y: 0, z: 0 },
          radii: { x: 1, y: 1, z: 1 }
        },
        {
          position: { x: 0, y: 0, z: 0 },
          radii: { x: 1, y: 1, z: 1 }
        }
      ]
    }),
  /distinct/
);

const rectangle = rasterizePlate(1, {
  kind: 'plate',
  normalAxis: 'z',
  normalStart: -1,
  thickness: 2,
  shape: {
    kind: 'rectangle',
    min: { u: -2, v: -1 },
    max: { u: 3, v: 2 }
  }
});
assert.equal(rectangle.cells.size, 5 * 3 * 2);
assert.ok(isSixConnected(rectangle));

const triangle = rasterizePlate(2, {
  kind: 'plate',
  normalAxis: 'y',
  normalStart: 0,
  thickness: 1,
  shape: {
    kind: 'triangle',
    vertices: [
      { u: 0, v: 0 },
      { u: 6, v: 0 },
      { u: 0, v: 6 }
    ]
  }
});
assert.ok(triangle.cells.size > 0);
assert.ok(triangle.cells.size < 36);

const trapezoid = rasterizePlate(2, {
  kind: 'plate',
  normalAxis: 'x',
  normalStart: 0,
  thickness: 2,
  shape: {
    kind: 'trapezoid',
    vertices: [
      { u: -3, v: 0 },
      { u: 3, v: 0 },
      { u: 2, v: 4 },
      { u: -2, v: 4 }
    ]
  }
});
assert.ok(trapezoid.cells.size > 0);
assert.throws(
  () =>
    rasterizePlate(1, {
      kind: 'plate',
      normalAxis: 'z',
      normalStart: 0,
      thickness: 1,
      shape: {
        kind: 'trapezoid',
        vertices: [
          { u: 0, v: 0 },
          { u: 4, v: 0 },
          { u: 3, v: 3 },
          { u: 0, v: 2 }
        ]
      }
    }),
  /parallel/
);

const disk = rasterizeRadial(2, {
  kind: 'radial',
  normalAxis: 'z',
  normalStart: 0,
  depth: 2,
  center: { u: 0, v: 0 },
  outerRadius: 5
});
const ring = rasterizeRadial(2, {
  kind: 'radial',
  normalAxis: 'z',
  normalStart: 0,
  depth: 2,
  center: { u: 0, v: 0 },
  outerRadius: 5,
  innerRadius: 2
});
assert.ok(disk.cells.size > ring.cells.size);
assert.ok(isSixConnected(disk));
assert.ok(isSixConnected(ring));

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

const solidBlockCells: LatticePoint[] = [];
for (let x = -2; x < 3; x += 1) {
  for (let y = 1; y < 4; y += 1) {
    for (let z = 0; z < 2; z += 1) {
      solidBlockCells.push({ x, y, z });
    }
  }
}
const solidBlock = createOccupancyGrid(4, solidBlockCells);
for (const order of GREEDY_AXIS_ORDERS) {
  const decomposition = decomposeWithAxisOrder(solidBlock, order);
  assert.equal(decomposition.cuboids.length, 1);
  assertExactDecomposition(solidBlock, decomposition);
}

for (const grid of [
  softMass,
  hardMass,
  sweptSegment,
  rectangle,
  triangle,
  trapezoid,
  disk,
  ring
]) {
  const candidates = GREEDY_AXIS_ORDERS.map((order) =>
    decomposeWithAxisOrder(grid, order)
  );
  for (const candidate of candidates) {
    assertExactDecomposition(grid, candidate);
  }
  const expected = [...candidates].sort(compareScores)[0];
  const selected = decomposeOccupancy(grid);
  assert.deepEqual(selected.score, expected.score);
  assertExactDecomposition(grid, selected);
  assert.equal(
    serializedDecomposition(selected),
    serializedDecomposition(decomposeOccupancy(grid))
  );
}

let randomState = 0x41534846;
const nextRandom = (): number => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 0x1_0000_0000;
};

for (let example = 0; example < 64; example += 1) {
  const cells: LatticePoint[] = [];
  for (let x = -2; x < 2; x += 1) {
    for (let y = -2; y < 2; y += 1) {
      for (let z = -2; z < 2; z += 1) {
        if (nextRandom() < 0.36) {
          cells.push({ x, y, z });
        }
      }
    }
  }
  if (cells.length === 0) {
    cells.push({ x: 0, y: 0, z: 0 });
  }
  const grid = createOccupancyGrid(
    ([1, 2, 4] as const)[example % 3],
    cells
  );
  for (const order of GREEDY_AXIS_ORDERS) {
    assertExactDecomposition(grid, decomposeWithAxisOrder(grid, order));
  }
  const first = decomposeOccupancy(grid);
  const second = decomposeOccupancy(grid);
  assertExactDecomposition(grid, first);
  assert.equal(
    serializedDecomposition(first),
    serializedDecomposition(second),
    'greedy decomposition must be deterministic'
  );
}

const twoByTwoByTwo: LatticePoint[] = [];
for (let x = 0; x < 2; x += 1) {
  for (let y = 0; y < 2; y += 1) {
    for (let z = 0; z < 2; z += 1) {
      twoByTwoByTwo.push({ x, y, z });
    }
  }
}
for (let mask = 1; mask < 1 << twoByTwoByTwo.length; mask += 1) {
  const grid = createOccupancyGrid(
    ([1, 2, 4] as const)[mask % 3],
    twoByTwoByTwo.filter((_, index) => (mask & (1 << index)) !== 0)
  );
  const first = decomposeOccupancy(grid);
  const second = decomposeOccupancy(grid);
  assertExactDecomposition(grid, first);
  assert.equal(
    serializedDecomposition(first),
    serializedDecomposition(second),
    `all 2×2×2 occupancies must decompose deterministically; mask=${mask}`
  );
}

const empty = createOccupancyGrid(1, []);
const emptyDecomposition = decomposeOccupancy(empty);
assert.equal(emptyDecomposition.cuboids.length, 0);
assertExactDecomposition(empty, emptyDecomposition);

assert.throws(
  () =>
    assertExactDecomposition(solidBlock, {
      density: 4,
      axisOrder: ['x', 'y', 'z'],
      cuboids: [
        {
          bounds: {
            min: { x: -2, y: 1, z: 0 },
            max: { x: 3, y: 4, z: 2 }
          }
        },
        {
          bounds: {
            min: { x: 0, y: 1, z: 0 },
            max: { x: 1, y: 2, z: 1 }
          }
        }
      ],
      score: {
        boxCount: 2,
        internalSeamArea: 0,
        aspectPenalty: 0,
        lexicalSignature: ''
      }
    }),
  /overlap/
);
