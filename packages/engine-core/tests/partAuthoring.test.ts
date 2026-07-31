import assert from 'node:assert/strict';

import {
  preserveExistingPartAuthoringDefaults,
  projectSpacePartAuthoringSpec,
  type PartAuthoringSpec,
  type PartSpec
} from '../src';

const existingRadial: PartSpec = {
  kind: 'radial',
  partId: 'wheel',
  parentPartId: 'body',
  materialId: 'rubber',
  joint: { kind: 'hinge', axis: 'x' },
  attachment: {
    parentAnchor: [8, 2, 0],
    partAnchor: [6, 2, 0]
  },
  axis: 'x',
  center: [6, 2, 0],
  outerRadius: 4,
  innerRadius: 2,
  depth: 2
};

assert.deepEqual(
  projectSpacePartAuthoringSpec(existingRadial),
  {
    kind: 'radial',
    partId: 'wheel',
    parentPartId: 'body',
    materialId: 'rubber',
    joint: { kind: 'hinge', axis: 'x' },
    axis: 'x',
    center: [8, 2, 0],
    outerRadius: 4,
    innerRadius: 2,
    depth: 2
  }
);

const radialUpdate: PartAuthoringSpec = {
  kind: 'radial',
  partId: 'wheel',
  materialId: 'rubber',
  axis: 'x',
  center: [9, 2, 0],
  outerRadius: 5,
  depth: 2
};
assert.deepEqual(
  preserveExistingPartAuthoringDefaults(
    radialUpdate,
    existingRadial
  ),
  {
    ...radialUpdate,
    parentPartId: 'body',
    joint: { kind: 'hinge', axis: 'x' },
    innerRadius: 2
  }
);

const existingFeature: PartSpec = {
  kind: 'feature',
  partId: 'eye',
  parentPartId: 'head',
  materialId: 'eye',
  joint: { kind: 'fixed' },
  attachment: {
    parentAnchor: [0, 4, 2],
    partAnchor: [0, 4, 2]
  },
  face: 'south',
  anchor: [0, 4, 2],
  size: [2, 2],
  relief: 3
};
const featureUpdate: PartAuthoringSpec = {
  kind: 'feature',
  partId: 'eye',
  materialId: 'eye',
  face: 'south',
  anchor: [1, 4, 2],
  size: [2, 2]
};
assert.equal(
  preserveExistingPartAuthoringDefaults(
    featureUpdate,
    existingFeature
  ).relief,
  3
);

const explicitFeatureUpdate: PartAuthoringSpec = {
  ...featureUpdate,
  parentPartId: 'face',
  joint: { kind: 'ball' },
  relief: 1
};
assert.deepEqual(
  preserveExistingPartAuthoringDefaults(
    explicitFeatureUpdate,
    existingFeature
  ),
  explicitFeatureUpdate
);

const newFeature = preserveExistingPartAuthoringDefaults(
  featureUpdate,
  undefined
);
assert.equal(Object.hasOwn(newFeature, 'parentPartId'), false);
assert.equal(Object.hasOwn(newFeature, 'joint'), false);
assert.equal(Object.hasOwn(newFeature, 'relief'), false);
