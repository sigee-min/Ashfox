import assert from 'node:assert/strict';

import {
  createBlankWorkbenchProject,
  createProjectOperation
} from '../src/features/workbench/newProject';
import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../src/application/projectIdentity';

const operation = createProjectOperation(
  {
    name: 'Copper Golem',
    target: 'geckolib5',
    density: 2
  }
);

assert.deepEqual(operation, {
  name: 'project.create',
  payload: {
    name: 'Copper Golem',
    target: 'geckolib5',
    density: 2
  }
});

const blank = createBlankWorkbenchProject('2026-07-29T00:00:00.000Z');
assert.equal(blank.id, WORKBENCH_PLACEHOLDER_PROJECT_ID);
assert.equal(blank.name, 'Untitled project');
assert.equal(blank.formatProfile.id, 'gltf.2');
assert.equal(blank.formatProfile.container, 'glb');
assert.deepEqual(blank.scene, { roots: [], nodes: {} });
assert.deepEqual(blank.textures, {});
assert.deepEqual(blank.animations, {});
