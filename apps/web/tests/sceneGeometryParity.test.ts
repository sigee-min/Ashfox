import assert from 'node:assert/strict';

import * as THREE from 'three';

import {
  buildGltf,
  createProjectFromInput,
  executeCommandBatch,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  addNodeGeometry
} from '../src/rendering/sceneGeometry';

const blank = createProjectFromInput({
  id: 'project-scene-geometry-parity',
  name: 'Scene geometry parity',
  target: 'gltf',
  namespace: 'ashfox',
  modelPath: 'scene_geometry_parity',
  createdAt: '2026-07-31T00:00:00.000Z'
}, 'local-0001');
const created = executeCommandBatch(blank, {
  batchId: 'batch-scene-geometry-parity',
  baseProjectId: blank.id,
  baseRevision: blank.revision,
  operations: [{
    name: 'scene.bones.create',
    payload: {
      bones: [{
        id: 'bone-parity',
        name: 'root',
        parentId: null
      }]
    }
  }, {
    name: 'scene.cubes.create',
    payload: {
      cubes: [{
        id: 'cube-parity',
        name: 'body',
        parentId: 'bone-parity',
        bounds: {
          from: [-2, 0, -2],
          to: [2, 4, 2]
        }
      }]
    }
  }]
}, { source: 'system' });
if (!created.ok) throw new Error(created.error.message);
const cube = created.document.scene.nodes['cube-parity'];
if (cube.kind !== 'cube') throw new Error('Cube fixture is unavailable.');

const retainedDirections = new Set(['north', 'up']);
const faces = Object.fromEntries(
  Object.entries(cube.faces).map(([direction, face]) => [
    direction,
    {
      ...face,
      enabled: retainedDirections.has(direction)
    }
  ])
) as unknown as typeof cube.faces;
const document: ProjectDocument = {
  ...created.document,
  scene: {
    ...created.document.scene,
    nodes: {
      ...created.document.scene.nodes,
      [cube.id]: {
        ...cube,
        faces
      }
    }
  }
};

const material = new THREE.MeshBasicMaterial();
const group = new THREE.Group();
addNodeGeometry(document.scene.nodes[cube.id], group, {
  materials: {
    resolve: () => material,
    dispose: () => material.dispose()
  },
  textures: document.textures,
  options: {
    assets: {},
    showSkeleton: false,
    showWireframe: true
  },
  selectable: []
});

const projected = group.children.find(
  (child): child is THREE.Mesh =>
    child instanceof THREE.Mesh && !child.userData.overlay
);
assert.ok(projected, 'viewport cube mesh must be projected');
assert.equal(projected.geometry.getIndex()?.count, 12);
assert.equal(projected.geometry.groups.length, retainedDirections.size);
assert.equal(
  Array.isArray(projected.material) ? projected.material.length : 1,
  retainedDirections.size
);

const compiled = buildGltf(document);
const exportedPrimitiveCount = compiled.document.meshes?.reduce(
  (count, mesh) => count + mesh.primitives.length,
  0
) ?? 0;
assert.equal(exportedPrimitiveCount, 1);
const exportedIndexCount = compiled.document.meshes?.reduce(
  (count, mesh) => count + mesh.primitives.reduce(
    (meshCount, primitive) => meshCount + (
      primitive.indices === undefined
        ? 0
        : compiled.document.accessors?.[primitive.indices].count ?? 0
    ),
    0
  ),
  0
) ?? 0;
assert.equal(
  exportedIndexCount,
  projected.geometry.getIndex()?.count,
  'viewport and batched glTF export must retain the same enabled triangles'
);

projected.geometry.dispose();
material.dispose();
