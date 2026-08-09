import assert from 'node:assert/strict';

import type { GeometryPartSpec } from '../../src/modeling/part';
import {
  compileSemanticPartCuboids,
  occupancyForCuboids
} from '../../src/modeling/cuboid/grammar';
import {
  partitionSurfaceOwnedCuboids
} from '../../src/modeling/surface/ownership';
import { createProjectDocument } from '../../src/project/create';
import { ensureGeneratedTexture } from '../../src/textures/generatedMaterial';
import { compilePartScene } from '../../src/modeling/part/compiler';
import { readCompiledParts } from '../../src/modeling/invariants';
import { validatePartRecipeProjection } from '../../src/modeling/projection';
import { normalizePartRecipe, withPartRecipe } from '../../src/modeling/recipe';

const common = {
  parentPartId: null,
  materialId: 'body',
  joint: { kind: 'fixed' } as const,
  attachment: null
};

const assertDisjoint = (part: GeometryPartSpec): void => {
  const cuboids = compileSemanticPartCuboids(part);
  assert.ok(cuboids.length > 0);
  assert.doesNotThrow(() => occupancyForCuboids(cuboids));
  assert.deepEqual(cuboids, compileSemanticPartCuboids(part));
};

const translatedBlock: GeometryPartSpec = {
  ...common,
  kind: 'mass',
  partId: 'translated-block',
  parentPartId: 'parent',
  attachment: {
    parentAnchor: [10, 1, 0],
    partAnchor: [1, 1, 0]
  },
  center: [0, 0, 0],
  radii: [2, 3, 4],
  profile: 'block'
};
assert.deepEqual(compileSemanticPartCuboids(translatedBlock), [
  {
    bounds: {
      min: { x: 7, y: -3, z: -4 },
      max: { x: 11, y: 3, z: 4 }
    }
  }
]);

const roundedMass: GeometryPartSpec = {
  ...common,
  kind: 'mass',
  partId: 'rounded-mass',
  center: [0, 0, 0],
  radii: [4, 3, 2],
  profile: 'soft'
};
const roundedCuboids = compileSemanticPartCuboids(roundedMass);
assert.equal(roundedCuboids.length, 3);
assert.equal(roundedCuboids[0].bounds.min.x, -4);
assert.equal(roundedCuboids[2].bounds.max.x, 4);
assertDisjoint(roundedMass);

const straightSegment: GeometryPartSpec = {
  ...common,
  kind: 'segment',
  partId: 'straight-segment',
  points: [
    [0, 0, 0],
    [6, 0, 0]
  ],
  radii: [
    [1, 1, 1],
    [1, 1, 1]
  ],
  profile: 'hard'
};
assert.deepEqual(compileSemanticPartCuboids(straightSegment), [
  {
    bounds: {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 7, y: 1, z: 1 }
    }
  }
]);

const turningSegment: GeometryPartSpec = {
  ...common,
  kind: 'segment',
  partId: 'turning-segment',
  points: [
    [0, 0, 0],
    [4, 0, 0],
    [4, 4, 0]
  ],
  radii: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ],
  profile: 'hard'
};
assert.equal(compileSemanticPartCuboids(turningSegment).length, 2);
assertDisjoint(turningSegment);

const taperedSegment: GeometryPartSpec = {
  ...common,
  kind: 'segment',
  partId: 'tapered-segment',
  points: [
    [0, 0, 0],
    [8, 0, 0]
  ],
  radii: [
    [3, 3, 3],
    [1, 1, 1]
  ],
  profile: 'balanced'
};
const taperCuboids = compileSemanticPartCuboids(taperedSegment);
assert.ok(taperCuboids.length >= 2 && taperCuboids.length <= 6);
assertDisjoint(taperedSegment);

const rectanglePlate: GeometryPartSpec = {
  ...common,
  kind: 'plate',
  partId: 'rectangle-plate',
  plane: 'xy',
  origin: [2, 3, 4],
  outline: [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3]
  ],
  thickness: 2
};
assert.deepEqual(compileSemanticPartCuboids(rectanglePlate), [
  {
    bounds: {
      min: { x: 2, y: 3, z: 4 },
      max: { x: 6, y: 6, z: 6 }
    }
  }
]);

const trianglePlate: GeometryPartSpec = {
  ...common,
  kind: 'plate',
  partId: 'triangle-plate',
  plane: 'xz',
  origin: [0, 2, 0],
  outline: [
    [0, 0],
    [8, 0],
    [4, 6]
  ],
  thickness: 1
};
const triangleCuboids = compileSemanticPartCuboids(trianglePlate);
assert.ok(triangleCuboids.length >= 2 && triangleCuboids.length <= 8);
assert.equal(
  occupancyForCuboids(triangleCuboids).cells.has('4,2,5'),
  true,
  'a sharp interior polygon turn must survive broad band simplification'
);
assertDisjoint(trianglePlate);

const trapezoidPlate: GeometryPartSpec = {
  ...common,
  kind: 'plate',
  partId: 'trapezoid-plate',
  plane: 'yz',
  origin: [3, 0, 0],
  outline: [
    [0, 0],
    [7, 0],
    [5, 5],
    [2, 5]
  ],
  thickness: 2
};
const trapezoidCuboids = compileSemanticPartCuboids(trapezoidPlate);
assert.ok(trapezoidCuboids.length >= 2 && trapezoidCuboids.length <= 8);
assertDisjoint(trapezoidPlate);

const disk: GeometryPartSpec = {
  ...common,
  kind: 'radial',
  partId: 'disk',
  axis: 'z',
  center: [0, 0, 3],
  outerRadius: 5,
  innerRadius: 0,
  depth: 2
};
assert.equal(compileSemanticPartCuboids(disk).length, 3);
assertDisjoint(disk);

const ring: GeometryPartSpec = {
  ...common,
  kind: 'radial',
  partId: 'ring',
  axis: 'z',
  center: [0, 0, 0],
  outerRadius: 5,
  innerRadius: 2,
  depth: 1
};
const ringCuboids = compileSemanticPartCuboids(ring);
assert.equal(ringCuboids.length, 4);
const ringOccupancy = occupancyForCuboids(ringCuboids);
assert.equal(ringOccupancy.cells.has('0,0,0'), false);
assertDisjoint(ring);

assert.equal(occupancyForCuboids(ringCuboids, 2).density, 2);
assert.throws(
  () =>
    occupancyForCuboids([
      {
        bounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 2, y: 2, z: 2 }
        }
      },
      {
        bounds: {
          min: { x: 1, y: 1, z: 1 },
          max: { x: 3, y: 3, z: 3 }
        }
      }
    ]),
  /overlap/
);

const surfaceOwned = partitionSurfaceOwnedCuboids([
  {
    ownerId: 'body',
    cuboid: {
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 4, y: 4, z: 4 }
      }
    }
  },
  {
    ownerId: 'arm',
    cuboid: {
      bounds: {
        min: { x: 4, y: 1, z: 1 },
        max: { x: 6, y: 3, z: 3 }
      }
    }
  }
]);
if (!surfaceOwned.ok) throw new Error(surfaceOwned.message);
assert.equal(surfaceOwned.ok, true);
assert.equal(
  surfaceOwned.occupancy.size,
  72,
  'surface partitioning must preserve the exact occupied solid'
);
assert.equal(
  surfaceOwned.cuboids.some((cuboid) =>
    Object.values(cuboid.faces).includes('mixed')
  ),
  false,
  'a partial attachment must split its host face before rendering'
);
const bodyEastFaces = surfaceOwned.cuboids
  .filter((cuboid) => cuboid.ownerId === 'body')
  .map((cuboid) => cuboid.faces.east);
assert.ok(bodyEastFaces.includes('internal'));
assert.ok(bodyEastFaces.includes('external'));

const projectionParts = [
  {
    kind: 'mass' as const,
    partId: 'body',
    parentPartId: null,
    materialId: 'base',
    joint: { kind: 'fixed' as const },
    attachment: null,
    center: [0, 0, 0] as const,
    radii: [4, 4, 4] as const,
    profile: 'block' as const
  },
  {
    kind: 'mass' as const,
    partId: 'arm',
    parentPartId: 'body',
    materialId: 'accent',
    joint: { kind: 'fixed' as const },
    attachment: {
      parentAnchor: [4, 0, 0] as const,
      partAnchor: [4, 0, 0] as const
    },
    center: [5, 0, 0] as const,
    radii: [1, 1, 1] as const,
    profile: 'block' as const
  }
];
const projectionMaterials = [
  { id: 'base', baseColor: '#112233' },
  { id: 'accent', baseColor: '#445566' }
];
const normalizedProjectionRecipe = normalizePartRecipe(
  projectionParts,
  projectionMaterials
);
if (!normalizedProjectionRecipe.ok) {
  throw new Error(normalizedProjectionRecipe.issues[0]?.message);
}
assert.equal(normalizedProjectionRecipe.ok, true);
const projectionSeed = ensureGeneratedTexture(createProjectDocument({
  id: 'surface-projection',
  name: 'surface projection',
  revision: 'r1',
  createdAt: '2026-08-09T00:00:00.000Z'
}));
const projectionCompile = compilePartScene(projectionSeed.document, {
  parts: normalizedProjectionRecipe.recipe.parts,
  materials: normalizedProjectionRecipe.recipe.materials,
  textureId: projectionSeed.textureId
});
if (!projectionCompile.ok) throw new Error(projectionCompile.message);
assert.equal(projectionCompile.ok, true);
const repeatedProjectionCompile = compilePartScene(projectionCompile.document, {
  parts: normalizedProjectionRecipe.recipe.parts,
  materials: normalizedProjectionRecipe.recipe.materials,
  textureId: projectionSeed.textureId
});
if (!repeatedProjectionCompile.ok) {
  throw new Error(repeatedProjectionCompile.message);
}
assert.equal(repeatedProjectionCompile.ok, true);
assert.equal(
  repeatedProjectionCompile.document,
  projectionCompile.document,
  'a no-op pipeline run preserves the exact immutable document boundary'
);
assert.deepEqual({
  createdIds: repeatedProjectionCompile.createdIds,
  changedIds: repeatedProjectionCompile.changedIds,
  removedIds: repeatedProjectionCompile.removedIds
}, { createdIds: [], changedIds: [], removedIds: [] });
const projectedDocument = withPartRecipe(
  projectionCompile.document,
  normalizedProjectionRecipe.recipe
);
const projectedParts = readCompiledParts(projectedDocument);
if (!projectedParts.ok) throw new Error(projectedParts.issues[0]?.message);
assert.equal(projectedParts.ok, true);
assert.deepEqual(
  validatePartRecipeProjection(projectedDocument, projectedParts.parts),
  [],
  'projection must compare the same surface-owned cuboid plan as compilation'
);
