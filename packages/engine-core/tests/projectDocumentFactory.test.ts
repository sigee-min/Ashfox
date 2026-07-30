import assert from 'node:assert/strict';

import {
  createProjectDocument,
  validateProjectDocument
} from '../src';

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
assert.equal(validateProjectDocument(project).valid, true);

assert.throws(() => createProjectDocument({
  id: 'project-invalid',
  name: ' ',
  revision: 'local-0001',
  createdAt: '2026-07-29T00:00:00.000Z'
}), /Project name/);
