import assert from 'node:assert/strict';

import {
  type BoneNode
} from '../src';
import {
  addSceneNode,
  transformsEqual,
  updateSceneNode
} from '../src/scene';
import { createJavaProject } from './helpers';

const project = createJavaProject();
const updated = updateSceneNode(project, 'cube-body', (node) => ({
  ...node,
  visible: false
}));

assert.notEqual(updated, project);
assert.equal(updated.scene.nodes['cube-body'].visible, false);
assert.equal(project.scene.nodes['cube-body'].visible, true);
assert.equal(
  updateSceneNode(project, 'missing-node', (node) => node),
  project
);

const childBone: BoneNode = {
  id: 'bone-child',
  kind: 'bone',
  name: 'child',
  parentId: 'bone-root',
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    pivot: [0, 1, 0]
  },
  visible: true
};
const withChild = addSceneNode(project, childBone);

assert.equal(withChild.scene.nodes['bone-child'], childBone);
assert.equal(addSceneNode(withChild, childBone), withChild);
assert.equal(
  transformsEqual(childBone.transform, { ...childBone.transform }),
  true
);
assert.equal(
  transformsEqual(childBone.transform, {
    ...childBone.transform,
    position: [0.01, 0, 0]
  }),
  false
);
