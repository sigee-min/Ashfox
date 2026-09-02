import assert from 'node:assert/strict';

import { rasterizeTexture } from '@ashfox/engine-core';
import { createWorkbenchProject } from '../fixtures/project';

const document = createWorkbenchProject().document;
const texture = Object.values(document.textures)[0];
if (!texture) throw new Error('Workbench fixture requires a compiled texture.');

const first = rasterizeTexture(document, texture);
const second = rasterizeTexture(document, texture);
assert.deepEqual([first.width, first.height], [texture.width, texture.height]);
assert.equal(first.rgba.length, texture.width * texture.height * 4);
assert.deepEqual(
  Array.from(first.rgba),
  Array.from(second.rgba),
  'the Web viewport must consume deterministic compiler-authored raster bytes'
);
assert.ok(
  new Set(Array.from(first.rgba).filter((_, index) => index % 4 !== 3)).size > 1,
  'the initial workspace surface should exercise a non-flat authored palette'
);

console.log('compiled workspace rasterization ok');
