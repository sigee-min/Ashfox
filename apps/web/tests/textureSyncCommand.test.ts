import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createTextureSyncOperation
} from '../src/features/textures/textureSyncCommand';
import {
  createWorkbenchProject
} from '../src/features/workbench/sampleProject';
import {
  MOONVEIL_TEXTURE_IDS
} from '../src/features/workbench/demo/moonveilKirin';

const synchronizedDocument = createWorkbenchProject();
const geometryCube = Object.values(
  synchronizedDocument.scene.nodes
).find((node) =>
  node.kind === 'cube' &&
  Object.values(node.faces).some((face) =>
    face.enabled &&
    face.textureId !== null &&
    synchronizedDocument.textures[face.textureId]?.atlasMode === 'generate'
  )
);
assert.ok(geometryCube && geometryCube.kind === 'cube');
if (!geometryCube || geometryCube.kind !== 'cube') {
  throw new Error('Generated texture fixture cube is unavailable');
}
const geometryChanged = executeCommandBatch(synchronizedDocument, {
  batchId: 'texture-sync-unsynchronized-fixture',
  baseRevision: synchronizedDocument.revision,
  operations: [{
    name: 'scene.cubes.geometry.update',
    payload: {
      updates: [{
        nodeId: geometryCube.id,
        bounds: {
          from: geometryCube.bounds.from,
          to: [
            geometryCube.bounds.to[0] + 1,
            geometryCube.bounds.to[1],
            geometryCube.bounds.to[2]
          ]
        }
      }]
    }
  }]
});
if (!geometryChanged.ok) throw new Error(geometryChanged.error.message);
const document = geometryChanged.document;
const operation = createTextureSyncOperation(document);
const originalEye = document.textures[MOONVEIL_TEXTURE_IDS.eye];
const originalAura = document.textures[MOONVEIL_TEXTURE_IDS.aura];
const importedWithoutAtlasModes = {
  ...document,
  textures: Object.fromEntries(
    Object.entries(document.textures).map(([id, texture]) => {
      const { atlasMode: _atlasMode, ...preservedTexture } = texture;
      return [id, preservedTexture];
    })
  )
};
const importedWithoutTextures = structuredClone(document);
for (const node of Object.values(importedWithoutTextures.scene.nodes)) {
  if (node.kind !== 'cube') continue;
  for (const face of Object.values(node.faces)) {
    (face as { textureId: null }).textureId = null;
  }
}
(importedWithoutTextures as {
  textures: Record<string, never>;
}).textures = {};

assert.ok(operation);
assert.equal(
  createTextureSyncOperation(importedWithoutTextures),
  null,
  'explicitly untextured projects have no generated recipe to synchronize'
);
assert.equal(
  createTextureSyncOperation(importedWithoutAtlasModes),
  null,
  'an omitted atlas mode must fail safe as preserve'
);
assert.equal(operation.name, 'textures.sync');
assert.deepEqual(operation.payload, {});

const result = executeCommandBatch(document, {
  batchId: 'texture-sync-command-test',
  baseRevision: document.revision,
  operations: [operation]
});

assert.equal(result.ok, true);
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
  assert.equal(
    result.document.settings.generatedTextureRecipe?.lightDir,
    'tl_br'
  );

  const goldCube = Object.values(result.document.scene.nodes).find(
    (node) =>
      node.kind === 'cube' &&
      node.faces.north.textureId === MOONVEIL_TEXTURE_IDS.gold
  );
  assert.ok(goldCube && goldCube.kind === 'cube');
  if (!goldCube || goldCube.kind !== 'cube') {
    throw new Error('Gold detail surface is unavailable');
  }
  const detailed = executeCommandBatch(result.document, {
    batchId: 'texture-detail-anchor-test',
    baseRevision: result.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: MOONVEIL_TEXTURE_IDS.gold,
        upsert: [{
          id: 'detail-gold-mark',
          color: '#fff4c0',
          anchor: {
            kind: 'surface',
            nodeId: goldCube.id,
            face: 'north',
            u: 0.25,
            v: 0.25,
            width: 0.5,
            height: 0.5
          }
        }]
      }
    }, {
      name: 'textures.sync',
      payload: {}
    }]
  });
  assert.equal(detailed.ok, true);
  if (detailed.ok) {
    const detailedCube = detailed.document.scene.nodes[goldCube.id];
    const detail = detailedCube.kind === 'cube'
      ? detailedCube.faces.north.details[0]
      : undefined;
    assert.equal(detail?.id, 'detail-gold-mark');
    const sourceCube = detailed.document.scene.nodes[goldCube.id];
    assert.equal(sourceCube.kind, 'cube');
    if (sourceCube.kind !== 'cube') {
      throw new Error('Detailed gold cube is unavailable');
    }
    const rebuilt = executeCommandBatch(detailed.document, {
      batchId: 'texture-detail-rebuild-test',
      baseRevision: detailed.document.revision,
      operations: [{
        name: 'scene.cubes.geometry.update',
        payload: {
          updates: [{
            nodeId: sourceCube.id,
            bounds: {
              from: sourceCube.bounds.from,
              to: [
                sourceCube.bounds.to[0] + 1,
                sourceCube.bounds.to[1],
                sourceCube.bounds.to[2]
              ]
            }
          }]
        }
      }, {
        name: 'textures.sync',
        payload: {}
      }]
    });
    assert.equal(rebuilt.ok, true);
    if (!rebuilt.ok) throw new Error(rebuilt.error.message);
    assert.deepEqual(
      rebuilt.document.scene.nodes[goldCube.id].kind === 'cube'
        ? rebuilt.document.scene.nodes[goldCube.id].faces.north.details
        : [],
      sourceCube.faces.north.details
    );
    assert.ok(
      !rebuilt.findings.some(
        (finding) => finding.code === 'texture.recipe_unsynchronized'
      )
    );
    const repeated = executeCommandBatch(rebuilt.document, {
      batchId: 'texture-sync-command-repeat-test',
      baseRevision: rebuilt.document.revision,
      operations: [{
        name: 'textures.sync',
        payload: {}
      }]
    });
    assert.equal(repeated.ok, false);
    if (!repeated.ok) assert.equal(repeated.error.code, 'no_change');
  }
}
