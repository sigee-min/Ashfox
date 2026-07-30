import assert from 'node:assert/strict';

import {
  composeTextureRaster,
  executeCommandBatch,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createTextureSyncOperation,
  projectNeedsTextureSynchronization
} from '../src/features/textures/textureSyncCommand';
import {
  createWorkbenchProject
} from '../src/features/workbench/sampleProject';

const synchronized = createWorkbenchProject();
assert.equal(projectNeedsTextureSynchronization(synchronized), false);

const sourceCube = Object.values(synchronized.scene.nodes).find(
  (node) => node.kind === 'cube'
);
assert.ok(sourceCube && sourceCube.kind === 'cube');
if (!sourceCube || sourceCube.kind !== 'cube') {
  throw new Error('Generated texture fixture cube is unavailable');
}

const geometryChanged = executeCommandBatch(synchronized, {
  batchId: 'texture-sync-unsynchronized-fixture',
  baseRevision: synchronized.revision,
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
  }]
});
if (!geometryChanged.ok) throw new Error(geometryChanged.error.message);
assert.equal(
  projectNeedsTextureSynchronization(geometryChanged.document),
  true
);

const operation = createTextureSyncOperation(geometryChanged.document);
assert.deepEqual(operation, {
  name: 'textures.sync',
  payload: {}
});

const result = executeCommandBatch(geometryChanged.document, {
  batchId: 'texture-sync-command-test',
  baseRevision: geometryChanged.document.revision,
  operations: operation ? [operation] : []
});
assert.equal(result.ok, true);
if (!result.ok) throw new Error(result.error.message);
assert.equal(result.document.settings.uvPixelsPerUnit, 1);
assert.equal(validateProjectDocument(result.document).valid, true);
assert.equal(projectNeedsTextureSynchronization(result.document), false);

const generatedTexture = Object.values(result.document.textures).find(
  (texture) => texture.atlasMode === 'generate'
);
assert.ok(generatedTexture);
if (!generatedTexture) throw new Error('Generated atlas is unavailable');
const composition = composeTextureRaster(
  result.document,
  generatedTexture
);
assert.ok(composition.regions.length > 0);
assert.ok(
  composition.regions.every(
    (region) =>
      Number.isInteger(region.width) &&
      Number.isInteger(region.height) &&
      region.width > 0 &&
      region.height > 0
  )
);

const repeated = executeCommandBatch(result.document, {
  batchId: 'texture-sync-command-repeat-test',
  baseRevision: result.document.revision,
  operations: [{
    name: 'textures.sync',
    payload: {}
  }]
});
assert.equal(repeated.ok, false);
if (!repeated.ok) assert.equal(repeated.error.code, 'no_change');

const beforeFractional = structuredClone(
  result.document.scene.nodes[sourceCube.id]
);
const fractional = executeCommandBatch(result.document, {
  batchId: 'texture-sync-fractional-grid-test',
  baseRevision: result.document.revision,
  operations: [
    {
      name: 'scene.cubes.geometry.update',
      payload: {
        updates: [{
          nodeId: sourceCube.id,
          bounds: {
            from: sourceCube.bounds.from,
            to: [
              sourceCube.bounds.to[0] + 0.5,
              sourceCube.bounds.to[1],
              sourceCube.bounds.to[2]
            ]
          }
        }]
      }
    },
    {
      name: 'textures.sync',
      payload: {}
    }
  ]
});
assert.equal(fractional.ok, false);
if (fractional.ok) {
  throw new Error('Fractional generated surface must be rejected');
}
assert.equal(fractional.error.code, 'invalid_state');
assert.match(fractional.error.message, /square-pixel grid/);
assert.deepEqual(
  result.document.scene.nodes[sourceCube.id],
  beforeFractional
);

const untextured = structuredClone(result.document);
for (const node of Object.values(untextured.scene.nodes)) {
  if (node.kind !== 'cube') continue;
  for (const face of Object.values(node.faces)) {
    face.textureId = null;
  }
}
untextured.textures = {};
assert.equal(createTextureSyncOperation(untextured), null);
