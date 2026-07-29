import assert from 'node:assert/strict';

import {
  createProjectDocument,
  validateProjectDocument
} from '../src';

const project = createProjectDocument({
  id: 'project-empty',
  name: ' Empty project ',
  revision: 'local-0001',
  createdAt: '2026-07-29T00:00:00.000Z',
  textureResolution: 64
});

assert.equal(project.name, 'Empty project');
assert.deepEqual(project.settings.textureResolution, {
  width: 64,
  height: 64
});
assert.deepEqual(project.scene, { roots: [], nodes: {} });
assert.equal(validateProjectDocument(project).valid, true);

assert.throws(
  () => createProjectDocument({
    id: 'project-invalid',
    name: 'Invalid',
    revision: 'local-0001',
    createdAt: '2026-07-29T00:00:00.000Z',
    textureResolution: 0
  }),
  /Texture resolution/
);
