import assert from 'node:assert/strict';

import {
  BLANK_WORKBENCH_PROJECT_ID,
  createBlankWorkbenchProject,
  createNewProjectDocument
} from '../src/features/workbench/newProject';

const project = createNewProjectDocument(
  {
    name: 'Copper Golem',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'copper_golem',
    textureResolution: 128
  },
  {
    id: 'project-copper-golem',
    createdAt: '2026-07-29T00:00:00.000Z'
  }
);

assert.equal(project.id, 'project-copper-golem');
assert.equal(project.revision, 'local-0001');
assert.equal(project.formatProfile.id, 'minecraft.java.geckolib5');
assert.equal(Object.keys(project.animations).length, 1);
assert.equal(
  project.animations['animation-rest-pose'].name,
  'animation.copper_golem.rest_pose'
);
assert.deepEqual(project.scene, { roots: [], nodes: {} });
assert.deepEqual(project.settings.textureResolution, {
  width: 128,
  height: 128
});

const blank = createBlankWorkbenchProject('2026-07-29T00:00:00.000Z');
assert.equal(blank.id, BLANK_WORKBENCH_PROJECT_ID);
assert.equal(blank.name, 'Untitled project');
assert.equal(blank.formatProfile.id, 'gltf.2');
assert.equal(blank.formatProfile.container, 'glb');
assert.deepEqual(blank.scene, { roots: [], nodes: {} });
assert.deepEqual(blank.textures, {});
assert.deepEqual(blank.animations, {});
