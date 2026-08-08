import assert from 'node:assert/strict';

import {
  completePartAuthoringSpec,
  projectSpacePartAuthoringSpec,
  type PartAuthoringSpec,
  type PartSpec
} from '../src';

const complete = (
  input: PartAuthoringSpec,
  existing?: PartSpec
): PartAuthoringSpec => {
  const result = completePartAuthoringSpec(input, existing);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.issue.message);
  return result.value;
};

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
  outerRadius: 5
};
assert.deepEqual(
  complete(radialUpdate, existingRadial),
  {
    kind: 'radial',
    partId: 'wheel',
    parentPartId: 'body',
    materialId: 'rubber',
    joint: { kind: 'hinge', axis: 'x' },
    axis: 'x',
    center: [8, 2, 0],
    outerRadius: 5,
    innerRadius: 2,
    depth: 2
  }
);

const existingFeature: PartSpec = {
  kind: 'feature',
  partId: 'eye',
  parentPartId: 'head',
  materialId: 'eye',
  joint: { kind: 'fixed' },
  attachment: null,
  motif: 'eye',
  face: 'south',
  anchor: [0, 4, 2],
  size: [4, 3]
};

const patchFixtures: readonly PartSpec[] = [{
  kind: 'mass',
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [0, 0, 0],
  radii: [4, 3, 2],
  profile: 'soft'
}, {
  kind: 'segment',
  partId: 'tail',
  parentPartId: 'body',
  materialId: 'gold',
  joint: { kind: 'ball' },
  attachment: {
    parentAnchor: [4, 0, 0],
    partAnchor: [0, 0, 0]
  },
  points: [[0, 0, 0], [3, 1, 0]],
  radii: [[1, 1, 1], [2, 1, 1]],
  profile: 'hard'
}, {
  kind: 'plate',
  partId: 'wing',
  parentPartId: 'body',
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: {
    parentAnchor: [0, 2, 0],
    partAnchor: [0, 0, 0]
  },
  plane: 'xz',
  origin: [0, 0, 0],
  outline: [[0, 0], [5, 0], [4, 3], [0, 3]],
  thickness: 2
}, existingRadial, existingFeature];

for (const fixture of patchFixtures) {
  assert.deepEqual(
    complete(
      {
        kind: fixture.kind,
        partId: fixture.partId
      } as PartAuthoringSpec,
      fixture
    ),
    projectSpacePartAuthoringSpec(fixture),
    `${fixture.kind} patch must preserve every omitted field`
  );
}

const featureUpdate: PartAuthoringSpec = {
  kind: 'feature',
  partId: 'eye',
  anchor: [1, 4, 2]
};
assert.deepEqual(complete(featureUpdate, existingFeature), {
  kind: 'feature',
  partId: 'eye',
  parentPartId: 'head',
  materialId: 'eye',
  joint: { kind: 'fixed' },
  motif: 'eye',
  face: 'south',
  anchor: [1, 4, 2],
  size: [4, 3]
});

const explicitFeatureUpdate: PartAuthoringSpec = {
  ...featureUpdate,
  parentPartId: 'face',
  joint: { kind: 'fixed' }
};
assert.deepEqual(
  complete(explicitFeatureUpdate, existingFeature),
  {
    kind: 'feature',
    partId: 'eye',
    parentPartId: 'face',
    materialId: 'eye',
    joint: { kind: 'fixed' },
    motif: 'eye',
    face: 'south',
    anchor: [1, 4, 2],
    size: [4, 3]
  }
);

const newFeature = complete(
  featureUpdate,
  undefined
);
assert.equal(Object.hasOwn(newFeature, 'parentPartId'), false);
assert.equal(Object.hasOwn(newFeature, 'joint'), false);
assert.equal(Object.hasOwn(newFeature, 'motif'), false);

const newEye = complete({
  kind: 'feature',
  partId: 'eye.new',
  parentPartId: 'head',
  materialId: 'eye',
  motif: 'eye',
  face: 'south',
  anchor: [0, 4, 2],
  size: [4, 3]
});
assert.equal(newEye.kind, 'feature');
if (newEye.kind === 'feature') {
  assert.equal(newEye.glyph, 'square');
}

const newSurfacePatch = complete({
  kind: 'feature',
  partId: 'muzzle.patch',
  parentPartId: 'head',
  materialId: 'cream',
  motif: 'patch',
  face: 'south',
  anchor: [0, 2, 2],
  size: [4, 2]
});
assert.equal(newSurfacePatch.kind, 'feature');
if (newSurfacePatch.kind === 'feature') {
  assert.equal(newSurfacePatch.glyph, undefined);
}

const newNose = complete({
  kind: 'feature',
  partId: 'nose.new',
  parentPartId: 'head',
  materialId: 'nose',
  motif: 'nose',
  face: 'south',
  anchor: [0, 1, 2],
  size: [2, 2]
});
assert.equal(newNose.kind, 'feature');
if (newNose.kind === 'feature') {
  assert.equal(newNose.glyph, 'dot');
}

const newMouth = complete({
  kind: 'feature',
  partId: 'mouth.new',
  parentPartId: 'head',
  materialId: 'mouth',
  motif: 'mouth',
  face: 'south',
  anchor: [0, -1, 2],
  size: [3, 1]
});
assert.equal(newMouth.kind, 'feature');
if (newMouth.kind === 'feature') {
  assert.equal(newMouth.glyph, 'neutral');
}

const segment = complete({
  kind: 'segment',
  partId: 'tail',
  materialId: 'gold',
  points: [[0, 0, 0], [2, 0, 0], [4, 1, 0]],
  radii: [1, 2, 1]
});
assert.equal(segment.kind, 'segment');
if (segment.kind === 'segment') {
  assert.deepEqual(segment.radii, [
    [1, 2, 1],
    [1, 2, 1],
    [1, 2, 1]
  ]);
}

const rectangle = complete({
  kind: 'plate',
  partId: 'wing',
  materialId: 'gold',
  plane: 'xy',
  origin: [0, 0, 0],
  size: [6, 3],
  thickness: 1
});
assert.equal(rectangle.kind, 'plate');
if (rectangle.kind === 'plate') {
  assert.equal(Object.hasOwn(rectangle, 'size'), false);
  assert.deepEqual(rectangle.outline, [
    [0, 0],
    [6, 0],
    [6, 3],
    [0, 3]
  ]);
}

const conflictingPlate = completePartAuthoringSpec({
  kind: 'plate',
  partId: 'conflict',
  materialId: 'gold',
  plane: 'xy',
  origin: [0, 0, 0],
  size: [2, 2],
  outline: [[0, 0], [2, 0], [0, 2]],
  thickness: 1
}, undefined);
assert.equal(conflictingPlate.ok, false);
