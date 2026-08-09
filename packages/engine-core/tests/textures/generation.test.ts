import assert from 'node:assert/strict';

import {
  cubeFaceDimensions,
  deterministicPixelNoise,
  faceTexelSize,
  generatedSurfaceTonePalette,
  packUvAtlas,
  packUvAtlasWithGutter,
  pixelTonePalette,
  reduceAtlasPixelsPerBlock,
  shadePixelRect,
  stableTextureSeed
} from '../../src';

interface ReferenceOklab {
  l: number;
  a: number;
  b: number;
}

const srgbByteToLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

// Independent test oracle from the published OKLab matrix, deliberately not
// imported from the production color module.
const referenceOklab = (
  color: { r: number; g: number; b: number }
): ReferenceOklab => {
  const red = srgbByteToLinear(color.r);
  const green = srgbByteToLinear(color.g);
  const blue = srgbByteToLinear(color.b);
  const linearL = 0.4122214708 * red +
    0.5363325363 * green + 0.0514459929 * blue;
  const linearM = 0.2119034982 * red +
    0.6806995451 * green + 0.1073969566 * blue;
  const linearS = 0.0883024619 * red +
    0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(linearL);
  const mRoot = Math.cbrt(linearM);
  const sRoot = Math.cbrt(linearS);
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot -
      0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot +
      0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot -
      0.808675766 * sRoot
  };
};

const oklabChroma = (color: ReferenceOklab): number =>
  Math.hypot(color.a, color.b);

const oklabHue = (color: ReferenceOklab): number =>
  Math.atan2(color.b, color.a) * 180 / Math.PI;

const hueDistance = (left: number, right: number): number => {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
};

const colorKey = (color: { r: number; g: number; b: number }): string =>
  `${color.r},${color.g},${color.b}`;

const paletteCases = [
  ['black', { r: 0, g: 0, b: 0 }],
  ['near-black', { r: 1, g: 1, b: 1 }],
  ['dark-purple', { r: 32, g: 11, b: 55 }],
  ['copper', { r: 190, g: 110, b: 55 }],
  ['red', { r: 255, g: 0, b: 0 }],
  ['green', { r: 0, g: 255, b: 0 }],
  ['blue', { r: 0, g: 0, b: 255 }],
  ['cyan', { r: 0, g: 255, b: 255 }],
  ['magenta', { r: 255, g: 0, b: 255 }],
  ['yellow', { r: 255, g: 255, b: 0 }],
  ['near-white', { r: 254, g: 254, b: 254 }],
  ['white', { r: 255, g: 255, b: 255 }]
] as const;

for (const [label, color] of paletteCases) {
  const tonePalette = pixelTonePalette(color);
  assert.strictEqual(
    tonePalette,
    pixelTonePalette({ ...color }),
    `${label} palette must be a cached immutable region-level value`
  );
  assert.ok(
    Object.isFrozen(tonePalette) &&
    Object.values(tonePalette).every(Object.isFrozen),
    `${label} palette cache entries must be immutable`
  );
  const roleColors = [
    tonePalette.shadow,
    tonePalette.base,
    tonePalette.light
  ];
  assert.equal(
    new Set(roleColors.map(colorKey)).size,
    3,
    `${label} must derive three distinct tone roles`
  );
  const roleLabs = roleColors.map(referenceOklab);
  assert.ok(
    roleLabs[1].l - roleLabs[0].l >= 0.075 &&
    roleLabs[2].l - roleLabs[1].l >= 0.075,
    `${label} adjacent roles must preserve the compiler-owned OKLab interval`
  );
  const authoredLab = referenceOklab(color);
  const baseChroma = oklabChroma(roleLabs[1]);
  if (oklabChroma(authoredLab) >= 0.04 && baseChroma >= 0.04) {
    for (const roleLab of roleLabs) {
      assert.ok(
        hueDistance(oklabHue(authoredLab), oklabHue(roleLab)) <= 3,
        `${label} gamut mapping must preserve authored hue`
      );
      assert.ok(
        oklabChroma(roleLab) / baseChroma >= 0.35,
        `${label} gamut mapping must not wash a chromatic role toward gray`
      );
    }
  }
}

const faces = ['up', 'south', 'east', 'north', 'west', 'down'] as const;

const directionalStats = (
  color: { r: number; g: number; b: number },
  face: typeof faces[number]
): { meanLightness: number; toneCount: number } => {
  const tones = Object.values(generatedSurfaceTonePalette(color, face));
  return {
    meanLightness: tones.reduce(
      (total, tone) => total + referenceOklab(tone).l,
      0
    ) / tones.length,
    toneCount: new Set(tones.map(colorKey)).size
  };
};

for (const [label, color] of paletteCases) {
  const stats = Object.fromEntries(
    faces.map((face) => [face, directionalStats(color, face)])
  ) as Record<typeof faces[number], ReturnType<typeof directionalStats>>;
  assert.ok(
    faces.every((face) => stats[face].toneCount === 3),
    `${label} must retain all three roles on every generated cube face`
  );
  assert.ok(
    stats.up.meanLightness - stats.south.meanLightness >= 0.045 &&
    stats.south.meanLightness - stats.north.meanLightness >= 0.045 &&
    stats.north.meanLightness - stats.down.meanLightness >= 0.045,
    `${label} must preserve the six-face lightness hierarchy`
  );
  assert.equal(
    stats.south.meanLightness,
    stats.east.meanLightness,
    `${label} south/east peers must use the same directional authority`
  );
  assert.equal(
    stats.north.meanLightness,
    stats.west.meanLightness,
    `${label} north/west peers must use the same directional authority`
  );
  for (const face of faces) {
    assert.strictEqual(
      generatedSurfaceTonePalette(color, face),
      generatedSurfaceTonePalette({ ...color }, face),
      `${label}/${face} must reuse its cached generated palette`
    );
  }
}

const zeroSignal = {
  intensity: 0,
  edge: 0,
  noise: 0,
  seed: stableTextureSeed('zero-signal', 0x41534846),
  lightDir: 'tl_br'
} as const;
for (const [, color] of paletteCases) {
  for (const [width, height] of [[1, 1], [2, 2], [7, 5], [16, 16]]) {
    const rect = { x: 0, y: 0, width, height };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        assert.deepEqual(
          shadePixelRect(color, x, y, rect, zeroSignal),
          color,
          'zero-signal public fill must preserve the exact authored color'
        );
      }
    }
  }
}
const amplitudeRect = { x: 0, y: 0, width: 8, height: 8 };
const amplitudeConfig = {
  ...zeroSignal,
  intensity: 0.25
};
assert.deepEqual(
  shadePixelRect(
    { r: 100, g: 100, b: 100 },
    0,
    0,
    amplitudeRect,
    amplitudeConfig
  ),
  { r: 125, g: 125, b: 125 },
  'public fill intensity must remain the actual continuous shade amplitude'
);
assert.deepEqual(
  shadePixelRect(
    { r: 100, g: 100, b: 100 },
    7,
    7,
    amplitudeRect,
    amplitudeConfig
  ),
  { r: 75, g: 75, b: 75 },
  'public fill intensity must remain the actual continuous shade amplitude'
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
