import assert from 'node:assert/strict';

import {
  cubeFaceDimensions,
  deterministicPixelNoise,
  faceTexelSize,
  packUvAtlas,
  packUvAtlasWithGutter,
  paintDirectionalFocalSurfacePixel,
  paintDirectionalSurfacePixel,
  paintFocalSurfacePixel,
  paintSurfacePixel,
  reduceAtlasPixelsPerBlock,
  shadePixelRect,
  stableTextureSeed
} from '../src';

const directionalSeed = stableTextureSeed(
  'texture-copper:gold-body:north',
  0x41534846
);
assert.deepEqual(
  paintDirectionalSurfacePixel(
    { r: 100, g: 100, b: 100 },
    'up',
    0,
    0,
    1,
    1,
    directionalSeed
  ),
  paintSurfacePixel(
    { r: 108, g: 108, b: 108 },
    0,
    0,
    1,
    1,
    directionalSeed
  ),
  'directional tone must be owned by engine-core'
);

assert.deepEqual(
  paintDirectionalFocalSurfacePixel(
    { r: 100, g: 100, b: 100 },
    'up',
    0,
    0,
    1,
    1,
    directionalSeed
  ),
  paintFocalSurfacePixel(
    { r: 108, g: 108, b: 108 },
    0,
    0,
    1,
    1,
    directionalSeed
  ),
  'focal surface tone must keep the shared directional authority'
);

const surfaceToneCounts = (focal: boolean): number =>
  new Set(
    Array.from({ length: 64 }, (_, index) => {
      const x = index % 8;
      const y = Math.floor(index / 8);
      const color = (focal
        ? paintFocalSurfacePixel
        : paintSurfacePixel)(
        { r: 100, g: 100, b: 100 },
        x,
        y,
        8,
        8,
        directionalSeed
      );
      return `${color.r},${color.g},${color.b}`;
    })
  ).size;

assert.ok(
  surfaceToneCounts(true) < surfaceToneCounts(false),
  'focal host planes must use a quieter generated noise field'
);

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
assert.deepEqual(
  packUvAtlasWithGutter(
    [{ key: 'safe', width: 2, height: 2, value: 'safe' }],
    4,
    4,
    1
  )?.map(({ key, x, y, width, height }) => ({
    key,
    x,
    y,
    width,
    height
  })),
  [{ key: 'safe', x: 1, y: 1, width: 2, height: 2 }],
  'content UVs must reserve a real gutter on every atlas edge'
);

assert.equal(reduceAtlasPixelsPerBlock(16), 8);
assert.equal(reduceAtlasPixelsPerBlock(4), 3);
assert.equal(reduceAtlasPixelsPerBlock(1), null);

const seed = stableTextureSeed('texture-copper:gold-body:north', 0x41534846);
assert.equal(
  deterministicPixelNoise(3, 5, seed),
  deterministicPixelNoise(3, 5, seed)
);
assert.deepEqual(
  paintSurfacePixel(
    { r: 190, g: 110, b: 55 },
    3,
    5,
    8,
    8,
    seed
  ),
  paintSurfacePixel(
    { r: 190, g: 110, b: 55 },
    3,
    5,
    8,
    8,
    seed
  )
);
assert.deepEqual(
  paintSurfacePixel(
    { r: 190, g: 110, b: 55 },
    0,
    0,
    1,
    1,
    seed
  ),
  { r: 190, g: 110, b: 55 },
  'single-pixel details must keep the selected base color'
);
const palette = new Set(
    Array.from({ length: 64 }, (_, index) => {
      const color = paintSurfacePixel(
        { r: 190, g: 110, b: 55 },
        index % 8,
        Math.floor(index / 8),
        8,
        8,
        seed
      );
      return `${color.r}:${color.g}:${color.b}`;
    })
);
assert.ok(
  palette.size === 3,
  'large iconic faces must use exactly one bounded three-tone ramp'
);
const alternateSeed = stableTextureSeed(
  'texture-copper:gold-body:north:alternate',
  0x41534846
);
assert.ok(
  Array.from({ length: 64 }, (_, index) => {
    const x = index % 8;
    const y = Math.floor(index / 8);
    return JSON.stringify(
      paintSurfacePixel({ r: 190, g: 110, b: 55 }, x, y, 8, 8, seed)
    ) !== JSON.stringify(
      paintSurfacePixel(
        { r: 190, g: 110, b: 55 },
        x,
        y,
        8,
        8,
        alternateSeed
      )
    );
  }).some(Boolean),
  'stable semantic seeds must produce meaningful automatic tone placement'
);
assert.deepEqual(
  paintSurfacePixel(
    { r: 190, g: 110, b: 55 },
    0,
    0,
    2,
    2,
    seed
  ),
  paintSurfacePixel(
    { r: 190, g: 110, b: 55 },
    1,
    1,
    2,
    2,
    seed
  ),
  'compact faces must stay flat instead of inventing unreadable shading noise'
);

const thinRegion = { x: 0, y: 0, width: 2, height: 2 };
const baseColor = { r: 190, g: 110, b: 55 };
const thinA = shadePixelRect(baseColor, 0, 0, thinRegion, {
  intensity: 0.22,
  edge: 0,
  noise: 0,
  seed,
  lightDir: 'tl_br'
});
const thinB = shadePixelRect(baseColor, 0, 0, thinRegion, {
  intensity: 0.22,
  edge: 1,
  noise: 1,
  seed: seed + 1,
  lightDir: 'tl_br'
});
assert.deepEqual(thinA, thinB);
