import assert from 'node:assert/strict';

import {
  CUBE_FACE_DIRECTIONS,
  getCommandDefinition,
  validateProjectDocument,
  type CubeFaces
} from '../src';
import {
  MAX_PROJECT_TEXTURE_DETAILS,
  projectTextureDetailCount,
  remapCubeSurfaces
} from '../src/textures/surfaceDetails';
import { createGltfProject } from './helpers';

const project = createGltfProject();
const cube = project.scene.nodes['cube-body'];
if (cube.kind !== 'cube') throw new Error('Surface fixture cube missing');

const faces = Object.fromEntries(
  CUBE_FACE_DIRECTIONS.map((direction) => [
    direction,
    {
      ...cube.faces[direction],
      cullFace: direction,
      details: [{
        id: `detail-${direction}`,
        color: '#ffffff',
        u: 0.1,
        v: 0.2,
        width: 0.25,
        height: 0.3
      }]
    }
  ])
) as unknown as CubeFaces;

const mirroredFace = (
  direction: (typeof CUBE_FACE_DIRECTIONS)[number],
  axis: 'x' | 'y' | 'z'
): (typeof CUBE_FACE_DIRECTIONS)[number] => {
  if (axis === 'x' && direction === 'east') return 'west';
  if (axis === 'x' && direction === 'west') return 'east';
  if (axis === 'y' && direction === 'up') return 'down';
  if (axis === 'y' && direction === 'down') return 'up';
  if (axis === 'z' && direction === 'north') return 'south';
  if (axis === 'z' && direction === 'south') return 'north';
  return direction;
};

for (const axis of ['x', 'y', 'z'] as const) {
  const first = remapCubeSurfaces(faces, {
    kind: 'mirror',
    axis
  });
  for (const sourceDirection of CUBE_FACE_DIRECTIONS) {
    const targetDirection = mirroredFace(sourceDirection, axis);
    const detail = first.faces[targetDirection].details[0];
    const expectUFlip =
      axis === 'x' ||
      (
        axis === 'z' &&
        ['north', 'south', 'east', 'west'].includes(sourceDirection)
      );
    const expectVFlip =
      axis === 'y' ||
      (
        axis === 'z' &&
        ['up', 'down'].includes(sourceDirection)
      );
    assert.equal(detail.id, `detail-${sourceDirection}`);
    assert.equal(detail.u, expectUFlip ? 0.65 : 0.1);
    assert.equal(detail.v, expectVFlip ? 0.5 : 0.2);
    assert.equal(
      first.faces[targetDirection].cullFace,
      targetDirection
    );
  }
  const second = remapCubeSurfaces(first.faces, {
    kind: 'mirror',
    axis
  });
  assert.deepEqual(second.faces, faces);
}

const copied = remapCubeSurfaces(faces, {
  kind: 'copy',
  targetNodeId: 'cube-copy'
});
assert.equal(copied.createdDetailIds.length, 6);
assert.equal(
  copied.faces.north.details[0].id,
  'detail-north@cube-copy:north'
);
assert.deepEqual(faces.north.details[0], {
  id: 'detail-north',
  color: '#ffffff',
  u: 0.1,
  v: 0.2,
  width: 0.25,
  height: 0.3
});

const budgetProject = structuredClone(project);
budgetProject.textures['texture-base'] = {
  ...budgetProject.textures['texture-base'],
  atlasMode: 'generate',
  raster: {
    background: '#8e98a3',
    canvasDetails: []
  }
};
budgetProject.scene.nodes = {
  'bone-root': budgetProject.scene.nodes['bone-root']
};
for (let nodeIndex = 0; nodeIndex < 32; nodeIndex += 1) {
  const nodeId = `cube-budget-${nodeIndex}`;
  budgetProject.scene.nodes[nodeId] = {
    ...cube,
    id: nodeId,
    transform: {
      ...cube.transform,
      position: [nodeIndex * 10, 0, 0]
    },
    faces: Object.fromEntries(
      CUBE_FACE_DIRECTIONS.map((direction) => [
        direction,
        {
          ...cube.faces[direction],
          details: direction === 'north'
            ? Array.from({ length: 512 }, (_, detailIndex) => ({
                id: `detail-budget-${nodeIndex}-${detailIndex}`,
                color: '#ffffff',
                u: 0,
                v: 0,
                width: 0.1,
                height: 0.1
              }))
            : []
        }
      ])
    ) as CubeFaces
  };
}
assert.equal(
  projectTextureDetailCount(budgetProject),
  MAX_PROJECT_TEXTURE_DETAILS
);
const budgetResult = getCommandDefinition(
  'textures.details.upsert'
)?.apply(budgetProject, {
  textureId: 'texture-base',
  upsert: [{
    id: 'detail-over-budget',
    color: '#ffffff',
    anchor: {
      kind: 'surface',
      nodeId: 'cube-budget-0',
      face: 'south',
      u: 0,
      v: 0,
      width: 0.1,
      height: 0.1
    }
  }]
});
assert.equal(budgetResult?.ok, false);
if (budgetResult?.ok !== false) {
  throw new Error('Project detail budget must reject overflow');
}
assert.equal(budgetResult.error.code, 'invalid_state');
assert.equal(
  projectTextureDetailCount(budgetProject),
  MAX_PROJECT_TEXTURE_DETAILS
);
const overBudgetProject = structuredClone(budgetProject);
const overBudgetCube = overBudgetProject.scene.nodes['cube-budget-0'];
if (overBudgetCube.kind !== 'cube') {
  throw new Error('Budget cube missing');
}
overBudgetCube.faces.south.details = [{
  id: 'detail-over-budget',
  color: '#ffffff',
  u: 0,
  v: 0,
  width: 0.1,
  height: 0.1
}];
assert.ok(
  validateProjectDocument(overBudgetProject).findings.some(
    (finding) =>
      finding.code === 'texture.invalid_raster' &&
      finding.path === 'textures'
  )
);
