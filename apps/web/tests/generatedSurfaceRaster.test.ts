import assert from 'node:assert/strict';

import type {
  TextureCompositionRegion
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
  generatedSurfacePixel(
    { ...eyeRegion, markings: undefined },
    0,
    0
  ),
  'pixels outside the eye motif must preserve the parent surface'
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
