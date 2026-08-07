import assert from 'node:assert/strict';

import type {
  TextureCompositionRegion
} from '@ashfox/engine-core';
import {
  paintFeatureMotifPixel,
  paintDirectionalSurfacePixel,
  stableTextureSeed
} from '@ashfox/engine-core';

import {
  generatedSurfacePixel
} from '../src/rendering/renderTextureRaster';

const pattern = {
  seedKey: 'body:copper:north:0',
  bounds: {
    x: -1,
    y: 0,
    width: 2,
    height: 1
  }
} as const;

const region = (
  nodeId: string,
  origin: readonly [number, number],
  width: number
): TextureCompositionRegion => ({
  nodeId,
  face: 'north',
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

const eyeRegion: TextureCompositionRegion = {
  nodeId: 'cube-eye-parent',
  face: 'south',
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
  generatedSurfacePixel(eyeRegion, 0, 0),
  'the quieter focal host synthesis must remain deterministic'
);
assert.notDeepEqual(
  generatedSurfacePixel(eyeRegion, 0, 0),
  generatedSurfacePixel(
    { ...eyeRegion, markings: undefined },
    0,
    0
  ),
  'a focal marking must reduce automatic noise across its host plane'
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

const patchRegion: TextureCompositionRegion = {
  nodeId: 'cube-patch-parent',
  face: 'south',
  x: 0,
  y: 0,
  width: 8,
  height: 8,
  color: '#9B5D2E',
  pattern: {
    seedKey: 'body:coat:south:0',
    origin: [0, 0],
    bounds: { x: 0, y: 0, width: 8, height: 8 }
  },
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
  paintDirectionalSurfacePixel(
    { r: 231, g: 201, b: 141 },
    'south',
    3,
    4,
    8,
    8,
    stableTextureSeed(
      'body:coat:south:0:marking:belly.patch',
      0x41534846
    )
  ),
  'a patch must inherit the system-owned directional cluster and noise field'
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

const layeredRegion: TextureCompositionRegion = {
  ...patchRegion,
  markings: [
    ...(patchRegion.markings ?? []),
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
  ...patchRegion,
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
  }, ...(patchRegion.markings ?? [])]
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
  ...patchRegion,
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
  }, ...(patchRegion.markings ?? [])]
};
assert.deepEqual(
  generatedSurfacePixel(fangOverPatchRegion, 3, 3),
  { r: 245, g: 239, b: 215 },
  'a fang role must stay flat and render above generated patch noise'
);
