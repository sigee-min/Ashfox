import assert from 'node:assert/strict';

import {
  materialEmissionIntensity
} from '../src/features/workbench/viewport/sceneMaterials';

assert.equal(materialEmissionIntensity('default'), 0);
assert.equal(materialEmissionIntensity('emissive'), 1.15);
assert.equal(materialEmissionIntensity('additive'), 1.15);
assert.equal(materialEmissionIntensity('default', 15), 2.5);
assert.equal(materialEmissionIntensity('emissive', 10), 10 / 6);
assert.equal(materialEmissionIntensity('default', -1), 0);
