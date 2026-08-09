import assert from 'node:assert/strict';

import {
  measureStaticSupport,
  type CellKey
} from '../../src';
import { cellKey } from '../../src/modeling/lattice';

const cells = (
  values: readonly (readonly [number, number, number])[]
): readonly CellKey[] =>
  values.map(([x, y, z]) => cellKey({ x, y, z }));

const centered = measureStaticSupport(cells([
  [0, 0, 0],
  [0, 1, 0],
  [0, 2, 0]
]));
assert.equal(centered.stable, true);
assert.deepEqual(centered.centerOfMass, [0.5, 0.5]);
assert.equal(centered.supportCellCount, 1);
assert.equal(centered.supportHullArea, 1);

const cantilevered = measureStaticSupport(cells([
  [0, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [2, 1, 0],
  [3, 1, 0],
  [4, 1, 0]
]));
assert.equal(cantilevered.stable, false);
assert.deepEqual(cantilevered.centerOfMass, [13 / 6, 0.5]);

const twoSupports = measureStaticSupport(cells([
  [0, 0, 0],
  [4, 0, 0],
  [1, 1, 0],
  [2, 1, 0],
  [3, 1, 0]
]));
assert.equal(twoSupports.stable, true);
assert.equal(twoSupports.supportCellCount, 2);
assert.equal(twoSupports.projectedFootprintCellCount, 5);

const irregularSupport = measureStaticSupport(cells([
  [0, 0, 0],
  [0, 0, 1],
  [1, 0, 1],
  [2, 0, 1],
  [2, 0, 2],
  [1, 1, 1]
]));
assert.equal(irregularSupport.supportCellCount, 5);
assert.deepEqual(irregularSupport.centerOfMass, [1.5, 1.5]);
assert.equal(irregularSupport.stable, true);
assert.equal(irregularSupport.supportHullArea, 7);

const airborne = measureStaticSupport(cells([
  [0, 1, 0]
]));
assert.equal(airborne.stable, false);
assert.equal(airborne.supportCellCount, 0);

const empty = measureStaticSupport([]);
assert.equal(empty.stable, null);
assert.equal(empty.centerOfMass, null);
