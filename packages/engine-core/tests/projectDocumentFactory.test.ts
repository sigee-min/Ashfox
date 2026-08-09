import assert from 'node:assert/strict';

import {
  adaptProjectForExport,
  createProjectDocument,
  validateProjectDocument
} from '../src';
import { canonicalProjectFromExportAdapter } from '../src/export/adapter';
import { createTextureAsset } from '../src/textures/createTextureAsset';

const project = createProjectDocument({
  id: 'project-empty',
  name: ' Empty project ',
  revision: 'local-0001',
  createdAt: '2026-07-29T00:00:00.000Z'
});

assert.equal(project.name, 'Empty project');
assert.deepEqual(project.settings.textureResolution, {
  width: 16,
  height: 16
});
assert.equal(project.settings.surfacePixelDensity, 1);
assert.deepEqual(project.scene, { roots: [], nodes: {} });
assert.equal(Object.hasOwn(project, 'formatProfile'), false);
assert.equal(validateProjectDocument(project).valid, true);

const texturedProject = {
  ...project,
  textures: {
    'texture-base': createTextureAsset(project, {
      id: 'texture-base',
      name: 'base'
    })
  }
};
const minecraftDelivery = adaptProjectForExport(texturedProject, {
  target: 'bedrock',
  namespace: 'ashfox',
  modelPath: 'empty_project'
});
assert.equal(minecraftDelivery.formatProfile.id, 'minecraft.bedrock');
assert.ok(minecraftDelivery.textures['texture-base']?.minecraft);
assert.deepEqual(
  canonicalProjectFromExportAdapter(minecraftDelivery),
  texturedProject
);

const glbDelivery = adaptProjectForExport(texturedProject, {
  target: 'glb',
  modelPath: 'empty_project'
});
assert.equal(glbDelivery.formatProfile.id, 'gltf.2');
assert.equal(glbDelivery.formatProfile.container, 'glb');
assert.equal(glbDelivery.textures['texture-base']?.minecraft, undefined);
assert.equal(
  Object.hasOwn(texturedProject.textures['texture-base']!, 'minecraft'),
  false
);
assert.deepEqual(
  canonicalProjectFromExportAdapter(glbDelivery),
  texturedProject
);

const gltfAfterMinecraft = adaptProjectForExport(
  minecraftDelivery,
  {
    target: 'gltf',
    modelPath: 'empty_project'
  }
);
assert.equal(
  gltfAfterMinecraft.textures['texture-base']?.minecraft,
  undefined,
  'a new delivery adapter must not inherit a Minecraft texture binding'
);

assert.throws(() => createProjectDocument({
  id: 'project-invalid',
  name: ' ',
  revision: 'local-0001',
  createdAt: '2026-07-29T00:00:00.000Z'
}), /Project name/);
