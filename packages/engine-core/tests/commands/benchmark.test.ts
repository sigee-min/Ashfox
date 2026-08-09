import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import type { TextureAsset } from '../../src/model';
import { intentProgramOutputDigest } from '../../src/provenance/program';
import { createProjectDocument } from '../../src/project/create';
import {
  GENERATED_ATLAS_MAX_RESOLUTION
} from '../../src/textures/textureRecipe/surfaceMetrics';

const dimension = GENERATED_ATLAS_MAX_RESOLUTION;
const byteLength = dimension * dimension * 4;
assert.equal(dimension, 4_096);
assert.equal(byteLength, 67_108_864);

const texture: TextureAsset = {
  id: 'benchmark-atlas',
  name: 'Bounded benchmark atlas',
  width: dimension,
  height: dimension,
  source: {
    bucket: 'generated',
    key: 'generated/benchmark-atlas.png',
    contentType: 'image/png',
    contentHash: 'generated:benchmark-atlas'
  },
  visible: true,
  sampling: 'nearest',
  colorSpace: 'srgb',
  renderMode: 'default',
  renderSides: 'auto',
  atlasMode: 'generate',
  raster: {
    background: '#112233',
    canvasDetails: []
  }
};
const seed = createProjectDocument({
  id: 'project-digest-benchmark',
  name: 'Digest benchmark',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
});
const document = {
  ...seed,
  settings: {
    ...seed.settings,
    textureResolution: { width: dimension, height: dimension }
  },
  textures: { [texture.id]: texture }
};

const startedAt = performance.now();
const digest = intentProgramOutputDigest(document);
const elapsedMs = performance.now() - startedAt;
assert.match(digest, /^sha256:[0-9a-f]{64}$/u);
assert.ok(
  elapsedMs < 30_000,
  `one bounded 4096² raster/output digest took ${Math.round(elapsedMs)}ms`
);
