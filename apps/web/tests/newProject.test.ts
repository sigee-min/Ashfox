import assert from 'node:assert/strict';

import {
  BLANK_WORKBENCH_PROJECT_ID,
  createBlankWorkbenchProject,
  createProjectOperation
} from '../src/features/workbench/newProject';

const operation = createProjectOperation(
  {
    name: 'Copper Golem',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'copper_golem'
  },
  {
    id: 'project-copper-golem',
    createdAt: '2026-07-29T00:00:00.000Z'
  }
);

assert.deepEqual(operation, {
  name: 'project.create',
  payload: {
    id: 'project-copper-golem',
    name: 'Copper Golem',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'copper_golem',
    createdAt: '2026-07-29T00:00:00.000Z'
  }
});

const blank = createBlankWorkbenchProject('2026-07-29T00:00:00.000Z');
assert.equal(blank.id, BLANK_WORKBENCH_PROJECT_ID);
assert.equal(blank.name, 'Untitled project');
assert.equal(blank.formatProfile.id, 'gltf.2');
assert.equal(blank.formatProfile.container, 'glb');
assert.deepEqual(blank.scene, { roots: [], nodes: {} });
assert.deepEqual(blank.textures, {});
assert.deepEqual(blank.animations, {});
