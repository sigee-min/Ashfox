import assert from 'node:assert/strict';

import {
  cubeFaceDimensions,
  deterministicPixelNoise,
  faceTexelSize,
  packUvAtlas,
  reduceAtlasPixelsPerBlock,
  shadeMinecraftPixel,
  stableTextureSeed
} from '../src';

const from = [-4, 5, -5] as const;
const to = [4, 10, 5] as const;

assert.deepEqual(cubeFaceDimensions(from, to, 'north'), {
  width: 8,
  height: 5
});
assert.deepEqual(cubeFaceDimensions(from, to, 'east'), {
  width: 10,
  height: 5
});
assert.deepEqual(cubeFaceDimensions(from, to, 'up'), {
  width: 8,
  height: 10
});
assert.deepEqual(
  faceTexelSize({ width: 8, height: 5 }, 16, 16),
  { width: 8, height: 5 }
);

assert.deepEqual(
  packUvAtlas(
    [
      { key: 'a', width: 4, height: 2, value: 'a' },
      { key: 'b', width: 2, height: 4, value: 'b' },
      { key: 'c', width: 3, height: 3, value: 'c' }
    ],
    6,
    7,
    1
  )?.map(({ key, x, y }) => ({ key, x, y })),
  [
    { key: 'b', x: 0, y: 0 },
    { key: 'c', x: 3, y: 0 },
    { key: 'a', x: 0, y: 5 }
  ]
);
assert.equal(
  packUvAtlas(
    [{ key: 'large', width: 8, height: 8, value: null }],
    4,
    4,
    0
  ),
  null
);

assert.equal(reduceAtlasPixelsPerBlock(16), 8);
assert.equal(reduceAtlasPixelsPerBlock(4), 3);
assert.equal(reduceAtlasPixelsPerBlock(1), null);

const seed = stableTextureSeed('texture-copper:gold-body:north', 0x41534846);
assert.equal(
  deterministicPixelNoise(3, 5, seed),
  deterministicPixelNoise(3, 5, seed)
);

const thinRegion = { x: 0, y: 0, width: 2, height: 2 };
const baseColor = { r: 190, g: 110, b: 55 };
const thinA = shadeMinecraftPixel(baseColor, 0, 0, thinRegion, {
  intensity: 0.22,
  edge: 0,
  noise: 0,
  seed,
  lightDir: 'tl_br'
});
const thinB = shadeMinecraftPixel(baseColor, 0, 0, thinRegion, {
  intensity: 0.22,
  edge: 1,
  noise: 1,
  seed: seed + 1,
  lightDir: 'tl_br'
});
assert.deepEqual(thinA, thinB);
