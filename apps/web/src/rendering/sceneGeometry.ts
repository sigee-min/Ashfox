import * as THREE from 'three';

import type {
  ProjectDocument,
  SceneNode,
  TextureAsset
} from '@ashfox/engine-core';

import { subtractVectors } from './sceneTransform';
import type { ProjectMaterialLibrary } from './sceneMaterials';
import type { ProjectSceneOptions } from './sceneTypes';

interface GeometryBuildContext {
  materials: ProjectMaterialLibrary;
  textures: ProjectDocument['textures'];
  options: ProjectSceneOptions;
  selectable: THREE.Object3D[];
}

const CUBE_MATERIAL_ORDER = [
  'east',
  'west',
  'up',
  'down',
  'south',
  'north'
] as const;

const rotateUvs = (
  corners: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number]
  ],
  rotation: 0 | 90 | 180 | 270
) => {
  const turns = rotation / 90;
  const mappings = [
    [0, 1, 2, 3],
    [2, 0, 3, 1],
    [3, 2, 1, 0],
    [1, 3, 0, 2]
  ] as const;
  return mappings[turns].map((index) => corners[index]);
};

const normalizedFaceUvs = (
  texture: TextureAsset,
  uv: readonly [number, number, number, number],
  rotation: 0 | 90 | 180 | 270
) =>
  rotateUvs(
    [
      [uv[0] / texture.width, 1 - uv[1] / texture.height],
      [uv[2] / texture.width, 1 - uv[1] / texture.height],
      [uv[0] / texture.width, 1 - uv[3] / texture.height],
      [uv[2] / texture.width, 1 - uv[3] / texture.height]
    ],
    rotation
  );

const applyCubeFaceUvs = (
  geometry: THREE.BoxGeometry,
  node: Extract<SceneNode, { kind: 'cube' }>,
  textures: ProjectDocument['textures']
): void => {
  const attribute = geometry.getAttribute('uv');
  for (const [faceIndex, direction] of CUBE_MATERIAL_ORDER.entries()) {
    const face = node.faces[direction];
    const texture =
      face.textureId === null ? undefined : textures[face.textureId];
    if (!texture || !face.uv) continue;
    const uvs = normalizedFaceUvs(
      texture,
      face.uv,
      face.rotation ?? 0
    );
    for (const [cornerIndex, [u, v]] of uvs.entries()) {
      attribute.setXY(faceIndex * 4 + cornerIndex, u, v);
    }
  }
  attribute.needsUpdate = true;
};

const retainEnabledCubeFaces = (
  geometry: THREE.BoxGeometry,
  node: Extract<SceneNode, { kind: 'cube' }>
): readonly (typeof CUBE_MATERIAL_ORDER)[number][] => {
  const sourceIndex = geometry.getIndex();
  if (!sourceIndex) return [];
  const sourceGroups = [...geometry.groups];
  const enabledDirections = CUBE_MATERIAL_ORDER.filter(
    (direction) => node.faces[direction].enabled
  );
  const indices: number[] = [];
  geometry.clearGroups();
  for (const [materialIndex, direction] of enabledDirections.entries()) {
    const sourceMaterialIndex = CUBE_MATERIAL_ORDER.indexOf(direction);
    const sourceGroup =
      sourceGroups.find(
        (group) => group.materialIndex === sourceMaterialIndex
      ) ?? sourceGroups[sourceMaterialIndex];
    if (!sourceGroup) continue;
    const start = indices.length;
    for (
      let index = sourceGroup.start;
      index < sourceGroup.start + sourceGroup.count;
      index += 1
    ) {
      indices.push(sourceIndex.getX(index));
    }
    geometry.addGroup(start, sourceGroup.count, materialIndex);
  }
  geometry.setIndex(indices);
  return enabledDirections;
};

const addCubeGeometry = (
  node: Extract<SceneNode, { kind: 'cube' }>,
  group: THREE.Group,
  context: GeometryBuildContext
): void => {
  const size = subtractVectors(node.bounds.to, node.bounds.from);
  const geometry = new THREE.BoxGeometry(
    size[0] + node.inflate * 2,
    size[1] + node.inflate * 2,
    size[2] + node.inflate * 2
  );
  applyCubeFaceUvs(geometry, node, context.textures);
  const enabledDirections = retainEnabledCubeFaces(geometry, node);
  const center: [number, number, number] = [
    (node.bounds.from[0] + node.bounds.to[0]) / 2 - node.transform.pivot[0],
    (node.bounds.from[1] + node.bounds.to[1]) / 2 - node.transform.pivot[1],
    (node.bounds.from[2] + node.bounds.to[2]) / 2 - node.transform.pivot[2]
  ];
  const materials = enabledDirections.map((direction) => {
    const textureId = node.faces[direction].textureId;
    return context.materials.resolve(textureId, node.lightEmission);
  });
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.fromArray(center);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.nodeId = node.id;
  mesh.userData.kind = node.kind;
  group.add(mesh);
  context.selectable.push(mesh);

  if (!context.options.showWireframe) return;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: '#172028',
      transparent: true,
      opacity: 0.66
    })
  );
  edges.position.copy(mesh.position);
  edges.userData.overlay = true;
  group.add(edges);
};

const addMeshGeometry = (
  node: Extract<SceneNode, { kind: 'mesh' }>,
  group: THREE.Group,
  context: GeometryBuildContext
): void => {
  for (const face of Object.values(node.faces)) {
    const vertices = face.vertexIds
      .map((id) => node.vertices[id])
      .filter((vertex) => vertex !== undefined);
    if (vertices.length < 3) continue;

    const positions: number[] = [];
    const uvs: number[] = [];
    const texture =
      face.textureId === null
        ? undefined
        : context.textures[face.textureId];
    for (let index = 1; index < vertices.length - 1; index += 1) {
      for (const vertex of [
        vertices[0],
        vertices[index],
        vertices[index + 1]
      ]) {
        positions.push(
          vertex.position[0] - node.transform.pivot[0],
          vertex.position[1] - node.transform.pivot[1],
          vertex.position[2] - node.transform.pivot[2]
        );
        const uv = face.uv[vertex.id];
        if (texture && uv) {
          uvs.push(
            uv[0] / texture.width,
            1 - uv[1] / texture.height
          );
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    if (uvs.length * 3 === positions.length * 2) {
      geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(uvs, 2)
      );
    }
    geometry.computeVertexNormals();
    const material = context.materials.resolve(face.textureId);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.nodeId = node.id;
    mesh.userData.kind = node.kind;
    group.add(mesh);
    context.selectable.push(mesh);

    if (!context.options.showWireframe) continue;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: '#172028' })
    );
    edges.userData.overlay = true;
    group.add(edges);
  }
};

const addNodeHelper = (
  node: SceneNode,
  group: THREE.Group,
  selectable: THREE.Object3D[]
): void => {
  const helper =
    node.kind === 'locator'
      ? new THREE.AxesHelper(1.5)
      : new THREE.Mesh(
          new THREE.OctahedronGeometry(0.32, 0),
          new THREE.MeshBasicMaterial({
            color: node.kind === 'bone' ? '#e4a851' : '#7bd6d0',
            depthTest: false
          })
        );
  helper.renderOrder = 5;
  helper.userData.nodeId = node.id;
  helper.userData.kind = node.kind;
  helper.userData.overlay = true;
  group.add(helper);
  selectable.push(helper);
};

export const addNodeGeometry = (
  node: SceneNode,
  group: THREE.Group,
  context: GeometryBuildContext
): void => {
  if (node.kind === 'cube') addCubeGeometry(node, group, context);
  if (node.kind === 'mesh') addMeshGeometry(node, group, context);
  if (
    context.options.showSkeleton &&
    (node.kind === 'bone' || node.kind === 'locator')
  ) {
    addNodeHelper(node, group, context.selectable);
  }
};
