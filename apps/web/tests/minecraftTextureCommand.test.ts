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
import {
  MOONVEIL_TEXTURE_IDS
} from '../src/features/workbench/demo/moonveilKirin';

const document = createWorkbenchProject();
const operation = createMinecraftTextureOperation(document);
const originalEye = document.textures[MOONVEIL_TEXTURE_IDS.eye];
const originalAura = document.textures[MOONVEIL_TEXTURE_IDS.aura];
const originalLeftEye =
  document.scene.nodes['cube-eye-left-iris'];
const originalChestMoon =
  document.scene.nodes['cube-chest-moon'];
const importedWithoutAtlasModes = {
  ...document,
  textures: Object.fromEntries(
    Object.entries(document.textures).map(([id, texture]) => {
      const { atlasMode: _atlasMode, ...preservedTexture } = texture;
      return [id, preservedTexture];
    })
  )
};

assert.ok(operation);
assert.equal(
  createMinecraftTextureOperation(importedWithoutAtlasModes),
  null,
  'an omitted atlas mode must fail safe as preserve'
);
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
const preservedOnly = executeCommandBatch(document, {
  batchId: 'minecraft-texture-preserved-only-test',
  baseRevision: document.revision,
  operations: [{
    ...operation,
    payload: {
      ...operation.payload,
      target: {
        nodeIds: ['cube-eye-left-iris', 'cube-chest-moon']
      }
    }
  }]
});
assert.equal(preservedOnly.ok, false);
if (!preservedOnly.ok) {
  assert.equal(preservedOnly.error.code, 'invalid_state');
  assert.equal(preservedOnly.error.path, 'operations[0].payload.target');
}

if (result.ok) {
  assert.equal(result.document.settings.uvPixelsPerUnit, 1);
  assert.equal(validateProjectDocument(result.document).valid, true);
  assert.deepEqual(
    result.document.textures[MOONVEIL_TEXTURE_IDS.eye],
    originalEye
  );
  assert.deepEqual(
    result.document.textures[MOONVEIL_TEXTURE_IDS.aura],
    originalAura
  );
  assert.deepEqual(
    result.document.scene.nodes['cube-eye-left-iris'],
    originalLeftEye
  );
  assert.deepEqual(
    result.document.scene.nodes['cube-chest-moon'],
    originalChestMoon
  );
  assert.equal(originalEye.atlasMode, 'preserve');
  assert.equal(originalAura.atlasMode, 'preserve');
  assert.equal(
    result.effects.changedEntityIds.includes(
      MOONVEIL_TEXTURE_IDS.eye
    ),
    false
  );
  assert.equal(
    result.effects.changedEntityIds.includes(
      'cube-eye-left-iris'
    ),
    false
  );
  assert.equal(
    result.document.textures[
      MOONVEIL_TEXTURE_IDS.gold
    ].raster?.pattern?.kind,
    'minecraft_shaded_uv'
  );

  const repeatedOperation =
    createMinecraftTextureOperation(result.document);
  assert.ok(repeatedOperation);
  const repeated = executeCommandBatch(result.document, {
    batchId: 'minecraft-texture-command-repeat-test',
    baseRevision: result.document.revision,
    operations: [repeatedOperation]
  });
  assert.equal(repeated.ok, true);
  if (repeated.ok) {
    assert.deepEqual(
      repeated.document.textures[MOONVEIL_TEXTURE_IDS.eye],
      originalEye
    );
    assert.deepEqual(
      repeated.document.scene.nodes['cube-eye-left-iris'],
      originalLeftEye
    );
  }
}
