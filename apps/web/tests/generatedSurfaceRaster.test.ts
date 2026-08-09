import assert from 'node:assert/strict';

import type {
  TextureCompositionRegion
} from '@ashfox/engine-core';
import {
  DEFAULT_GENERATED_TONE_CUTOFFS,
  DEFAULT_PIXEL_SHADE_STYLE,
  FOCAL_PIXEL_SHADE_STYLE,
  generatedSurfacePixel,
  paintFeatureMotifPixel,
  stableTextureSeed
} from '@ashfox/engine-core';

type SurfacePattern = NonNullable<
  TextureCompositionRegion['pattern']
>;

const surfacePattern = (
  seedKey: string,
  origin: readonly [number, number],
  bounds: SurfacePattern['bounds'],
  tonePolicy: TextureCompositionRegion['tonePolicy']
): SurfacePattern => ({
  seedKey,
  tonePolicy,
  toneField: {
    config: {
      ...(tonePolicy === 'focal'
        ? FOCAL_PIXEL_SHADE_STYLE
        : DEFAULT_PIXEL_SHADE_STYLE),
      seed: stableTextureSeed(seedKey, 0x41534846)
    },
    cutoffs: DEFAULT_GENERATED_TONE_CUTOFFS,
    rect: { x: 0, y: 0, width: bounds.width, height: bounds.height }
  },
  origin,
  bounds
});

const pattern = surfacePattern(
  'body:copper:north:0',
  [-1, 0],
  {
    x: -1,
    y: 0,
    width: 2,
    height: 1
  },
  'regular'
);

const region = (
  nodeId: string,
  origin: readonly [number, number],
  width: number
): TextureCompositionRegion => ({
  nodeId,
  face: 'north',
  tonePolicy: 'regular',
  x: 0,
  y: 0,
  width,
  height: 1,
  color: '#BE6E37',
  pattern: {
    ...pattern,
    origin
  }
});

const whole = region('cube-whole', [-1, 0], 2);
const rightFragment = region('cube-right', [-1, 0], 1);
const leftFragment = region('cube-left', [0, 0], 1);

assert.deepEqual(
  generatedSurfacePixel(whole, 0, 0),
  generatedSurfacePixel(rightFragment, 0, 0),
  'the same world-lattice texel must not depend on cuboid identity'
);
assert.deepEqual(
  generatedSurfacePixel(whole, 1, 0),
  generatedSurfacePixel(leftFragment, 0, 0),
  'gradient, edge, and noise coordinates must use the shared surface'
);

const largePattern = surfacePattern(
  'body:copper:north:large',
  [0, 0],
  { x: 0, y: 0, width: 32, height: 32 },
  'regular'
);
const largeRegion = (
  nodeId: string,
  origin: readonly [number, number],
  width: number,
  height: number
): TextureCompositionRegion => ({
  nodeId,
  face: 'north',
  tonePolicy: 'regular',
  x: 0,
  y: 0,
  width,
  height,
  color: '#BE6E37',
  pattern: { ...largePattern, origin }
});
const largeWhole = largeRegion('large-whole', [0, 0], 32, 32);
const largeFragments = [
  largeRegion('large-nw', [0, 0], 16, 16),
  largeRegion('large-ne', [16, 0], 16, 16),
  largeRegion('large-sw', [0, 16], 16, 16),
  largeRegion('large-se', [16, 16], 16, 16)
] as const;
for (let y = 0; y < 32; y += 1) {
  for (let x = 0; x < 32; x += 1) {
    const fragmentIndex = Number(y >= 16) * 2 + Number(x >= 16);
    assert.deepEqual(
      generatedSurfacePixel(largeWhole, x, y),
      generatedSurfacePixel(
        largeFragments[fragmentIndex],
        x % 16,
        y % 16
      ),
      'a real multi-scale tone field must remain byte-identical across cuboid fragments'
    );
  }
}

const eyeRegion: TextureCompositionRegion = {
  nodeId: 'cube-eye-parent',
  face: 'south',
  tonePolicy: 'focal',
  x: 0,
  y: 0,
  width: 6,
  height: 5,
  color: '#9B5D2E',
  markings: [{
    id: 'eye.left',
    motif: 'eye',
    color: '#E6A72F',
    x: 1,
    y: 1,
    width: 4,
    height: 3,
    motifX: 0,
    motifY: 0,
    motifWidth: 4,
    motifHeight: 3
  }]
};

assert.deepEqual(
  generatedSurfacePixel(eyeRegion, 0, 0),
  generatedSurfacePixel(
    { ...eyeRegion, markings: undefined },
    0,
    0
  ),
  'focal host tone must come from compiled policy, not marking presence'
);
assert.notDeepEqual(
  generatedSurfacePixel(eyeRegion, 2, 2),
  generatedSurfacePixel(
    { ...eyeRegion, markings: undefined },
    2,
    2
  ),
  'the eye motif must override only its projected surface pixels'
);

const focalPanel: TextureCompositionRegion = {
  nodeId: 'cube-dark-focal-panel',
  face: 'south',
  tonePolicy: 'focal',
  x: 0,
  y: 0,
  width: 16,
  height: 16,
  color: '#200B37',
  pattern: surfacePattern(
    'body:purple:south:0',
    [0, 0],
    { x: 0, y: 0, width: 16, height: 16 },
    'focal'
  ),
  markings: [{
    id: 'panel.eye',
    motif: 'eye',
    color: '#B47AE0',
    x: 6,
    y: 6,
    width: 3,
    height: 3,
    motifX: 0,
    motifY: 0,
    motifWidth: 3,
    motifHeight: 3
  }]
};

let focalHostChangedPixelCount = 0;
for (let y = 0; y < focalPanel.height; y += 1) {
  for (let x = 0; x < focalPanel.width; x += 1) {
    const insideEye = x >= 6 && x < 9 && y >= 6 && y < 9;
    if (insideEye) continue;
    const color = generatedSurfacePixel(focalPanel, x, y);
    const regularColor = generatedSurfacePixel(
      { ...focalPanel, markings: undefined },
      x,
      y
    );
    if (
      color.r !== regularColor.r ||
      color.g !== regularColor.g ||
      color.b !== regularColor.b
    ) {
      focalHostChangedPixelCount += 1;
    }
  }
}
assert.equal(
  focalHostChangedPixelCount,
  0,
  'removing focal markings must not change any non-motif host texel'
);

const patchRegion: TextureCompositionRegion = {
  nodeId: 'cube-patch-parent',
  face: 'south',
  tonePolicy: 'regular',
  x: 0,
  y: 0,
  width: 8,
  height: 8,
  color: '#9B5D2E',
  pattern: surfacePattern(
    'body:coat:south:0',
    [0, 0],
    { x: 0, y: 0, width: 8, height: 8 },
    'regular'
  ),
  markings: [{
    id: 'belly.patch',
    motif: 'patch',
    color: '#E7C98D',
    x: 1,
    y: 1,
    width: 6,
    height: 6,
    motifX: 0,
    motifY: 0,
    motifWidth: 6,
    motifHeight: 6
  }]
};

const patchPixel = generatedSurfacePixel(patchRegion, 3, 4);
assert.deepEqual(
  patchPixel,
  generatedSurfacePixel(patchRegion, 3, 4),
  'semantic patch synthesis must be deterministic'
);
assert.deepEqual(
  patchPixel,
  generatedSurfacePixel(
    {
      ...patchRegion,
      color: '#E7C98D',
      markings: undefined
    },
    3,
    4
  ),
  'a patch must reuse the host tone role and only replace its palette'
);
assert.notDeepEqual(
  patchPixel,
  generatedSurfacePixel(
    { ...patchRegion, markings: undefined },
    3,
    4
  ),
  'the patch material must replace the host material without adding geometry'
);
assert.ok(
  new Set(
    Array.from({ length: 36 }, (_, index) => {
      const x = index % 6 + 1;
      const y = Math.floor(index / 6) + 1;
      const color = generatedSurfacePixel(patchRegion, x, y);
      return `${color.r},${color.g},${color.b}`;
    })
  ).size > 1,
  'the agent-provided base color must be expanded into generated pixel tones'
);

const focalPatchRegion: TextureCompositionRegion = {
  ...patchRegion,
  tonePolicy: 'focal',
  pattern: surfacePattern(
    'body:coat:south:0',
    [0, 0],
    { x: 0, y: 0, width: 8, height: 8 },
    'focal'
  )
};

const layeredRegion: TextureCompositionRegion = {
  ...focalPatchRegion,
  markings: [
    ...(focalPatchRegion.markings ?? []),
    {
      id: 'eye.left',
      motif: 'eye',
      glyph: 'square',
      color: '#E6A72F',
      x: 2,
      y: 2,
      width: 4,
      height: 3,
      motifX: 0,
      motifY: 0,
      motifWidth: 4,
      motifHeight: 3
    }
  ]
};
assert.notDeepEqual(
  generatedSurfacePixel(layeredRegion, 3, 3),
  generatedSurfacePixel(patchRegion, 3, 3),
  'a focal eye glyph must render above a broad semantic color patch'
);

const focalOverPatchRegion: TextureCompositionRegion = {
  ...focalPatchRegion,
  markings: [{
    id: 'nose.center',
    motif: 'nose',
    glyph: 'snout',
    color: '#D69E70',
    x: 2,
    y: 2,
    width: 4,
    height: 2,
    motifX: 0,
    motifY: 0,
    motifWidth: 4,
    motifHeight: 2
  }, ...(focalPatchRegion.markings ?? [])]
};
assert.deepEqual(
  generatedSurfacePixel(focalOverPatchRegion, 3, 3),
  paintFeatureMotifPixel(
    'nose',
    { r: 214, g: 158, b: 112 },
    1,
    1,
    4,
    2,
    'snout'
  ),
  'a flat focal nose role must win over a broad generated patch regardless of marking order'
);
assert.notDeepEqual(
  generatedSurfacePixel(focalOverPatchRegion, 3, 3),
  generatedSurfacePixel(patchRegion, 3, 3),
  'automatic patch noise must not leak into focal nose pixels'
);

const fangOverPatchRegion: TextureCompositionRegion = {
  ...focalPatchRegion,
  markings: [{
    id: 'mouth.center',
    motif: 'mouth',
    glyph: 'fang',
    color: '#B04643',
    x: 2,
    y: 2,
    width: 3,
    height: 2,
    motifX: 0,
    motifY: 0,
    motifWidth: 3,
    motifHeight: 2
  }, ...(focalPatchRegion.markings ?? [])]
};
assert.deepEqual(
  generatedSurfacePixel(fangOverPatchRegion, 3, 3),
  { r: 245, g: 239, b: 215 },
  'a fang role must stay flat and render above generated patch noise'
);
