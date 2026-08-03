import assert from 'node:assert/strict';

import type { GeometryPartSpec } from '../src/modeling/partContract';
import {
  compileSemanticPartCuboids,
  occupancyForCuboids
} from '../src/modeling/semanticCuboidGrammar';

const common = {
  parentPartId: null,
  materialId: 'body',
  joint: { kind: 'fixed' } as const,
  attachment: null
};

const assertDisjoint = (part: GeometryPartSpec): void => {
  const cuboids = compileSemanticPartCuboids(part);
  assert.ok(cuboids.length > 0);
  assert.doesNotThrow(() => occupancyForCuboids(cuboids));
  assert.deepEqual(cuboids, compileSemanticPartCuboids(part));
};

const translatedBlock: GeometryPartSpec = {
  ...common,
  kind: 'mass',
  partId: 'translated-block',
  parentPartId: 'parent',
  attachment: {
    parentAnchor: [10, 1, 0],
    partAnchor: [1, 1, 0]
  },
  center: [0, 0, 0],
  radii: [2, 3, 4],
  profile: 'block'
};
assert.deepEqual(compileSemanticPartCuboids(translatedBlock), [
  {
    bounds: {
      min: { x: 7, y: -3, z: -4 },
      max: { x: 11, y: 3, z: 4 }
    }
  }
]);

const roundedMass: GeometryPartSpec = {
  ...common,
  kind: 'mass',
  partId: 'rounded-mass',
  center: [0, 0, 0],
  radii: [4, 3, 2],
  profile: 'soft'
};
const roundedCuboids = compileSemanticPartCuboids(roundedMass);
assert.equal(roundedCuboids.length, 3);
assert.equal(roundedCuboids[0].bounds.min.x, -4);
assert.equal(roundedCuboids[2].bounds.max.x, 4);
assertDisjoint(roundedMass);

const straightSegment: GeometryPartSpec = {
  ...common,
  kind: 'segment',
  partId: 'straight-segment',
  points: [
    [0, 0, 0],
    [6, 0, 0]
  ],
  radii: [
    [1, 1, 1],
    [1, 1, 1]
  ],
  profile: 'hard'
};
assert.deepEqual(compileSemanticPartCuboids(straightSegment), [
  {
    bounds: {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 7, y: 1, z: 1 }
    }
  }
]);

const turningSegment: GeometryPartSpec = {
  ...common,
  kind: 'segment',
  partId: 'turning-segment',
  points: [
    [0, 0, 0],
    [4, 0, 0],
    [4, 4, 0]
  ],
  radii: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ],
  profile: 'hard'
};
assert.equal(compileSemanticPartCuboids(turningSegment).length, 2);
assertDisjoint(turningSegment);

const taperedSegment: GeometryPartSpec = {
  ...common,
  kind: 'segment',
  partId: 'tapered-segment',
  points: [
    [0, 0, 0],
    [8, 0, 0]
  ],
  radii: [
    [3, 3, 3],
    [1, 1, 1]
  ],
  profile: 'balanced'
};
const taperCuboids = compileSemanticPartCuboids(taperedSegment);
assert.ok(taperCuboids.length >= 2 && taperCuboids.length <= 6);
assertDisjoint(taperedSegment);

const rectanglePlate: GeometryPartSpec = {
  ...common,
  kind: 'plate',
  partId: 'rectangle-plate',
  plane: 'xy',
  origin: [2, 3, 4],
  outline: [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3]
  ],
  thickness: 2
};
assert.deepEqual(compileSemanticPartCuboids(rectanglePlate), [
  {
    bounds: {
      min: { x: 2, y: 3, z: 4 },
      max: { x: 6, y: 6, z: 6 }
    }
  }
]);

const trianglePlate: GeometryPartSpec = {
  ...common,
  kind: 'plate',
  partId: 'triangle-plate',
  plane: 'xz',
  origin: [0, 2, 0],
  outline: [
    [0, 0],
    [8, 0],
    [4, 6]
  ],
  thickness: 1
};
const triangleCuboids = compileSemanticPartCuboids(trianglePlate);
assert.ok(triangleCuboids.length >= 2 && triangleCuboids.length <= 8);
assert.equal(
  occupancyForCuboids(triangleCuboids).cells.has('4,2,5'),
  true,
  'a sharp interior polygon turn must survive broad band simplification'
);
assertDisjoint(trianglePlate);

const trapezoidPlate: GeometryPartSpec = {
  ...common,
  kind: 'plate',
  partId: 'trapezoid-plate',
  plane: 'yz',
  origin: [3, 0, 0],
  outline: [
    [0, 0],
    [7, 0],
    [5, 5],
    [2, 5]
  ],
  thickness: 2
};
const trapezoidCuboids = compileSemanticPartCuboids(trapezoidPlate);
assert.ok(trapezoidCuboids.length >= 2 && trapezoidCuboids.length <= 8);
assertDisjoint(trapezoidPlate);

const disk: GeometryPartSpec = {
  ...common,
  kind: 'radial',
  partId: 'disk',
  axis: 'z',
  center: [0, 0, 3],
  outerRadius: 5,
  innerRadius: 0,
  depth: 2
};
assert.equal(compileSemanticPartCuboids(disk).length, 3);
assertDisjoint(disk);

const ring: GeometryPartSpec = {
  ...common,
  kind: 'radial',
  partId: 'ring',
  axis: 'z',
  center: [0, 0, 0],
  outerRadius: 5,
  innerRadius: 2,
  depth: 1
};
const ringCuboids = compileSemanticPartCuboids(ring);
assert.equal(ringCuboids.length, 4);
const ringOccupancy = occupancyForCuboids(ringCuboids);
assert.equal(ringOccupancy.cells.has('0,0,0'), false);
assertDisjoint(ring);

assert.equal(occupancyForCuboids(ringCuboids, 2).density, 2);
assert.throws(
  () =>
    occupancyForCuboids([
      {
        bounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 2, y: 2, z: 2 }
        }
      },
      {
        bounds: {
          min: { x: 1, y: 1, z: 1 },
          max: { x: 3, y: 3, z: 3 }
        }
      }
    ]),
  /overlap/
);
