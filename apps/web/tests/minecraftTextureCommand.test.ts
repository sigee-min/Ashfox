import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createMinecraftTextureOperation
} from '../src/features/textures/minecraftTextureCommand';
import {
  createWorkbenchProject
} from '../src/features/workbench/sampleProject';

const document = createWorkbenchProject();
const operation = createMinecraftTextureOperation(document);

assert.ok(operation);
assert.equal(operation.name, 'textures.uvAtlas.generate');
assert.deepEqual(operation.payload, {
  target: {
    scope: 'all'
  },
  pixelsPerBlock: 16,
  padding: 1,
  maxResolution: 256,
  seed: 0x41534846,
  intensity: 0.22,
  edge: 0.12,
  noise: 0.06,
  lightDir: 'tl_br'
});

const result = executeCommandBatch(document, {
  batchId: 'minecraft-texture-command-test',
  baseRevision: document.revision,
  operations: [operation]
});

assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.document.settings.uvPixelsPerUnit, 1);
  assert.equal(validateProjectDocument(result.document).valid, true);
  assert.equal(
    result.document.textures['texture-copper'].raster?.pattern?.kind,
    'minecraft_shaded_uv'
  );
}
