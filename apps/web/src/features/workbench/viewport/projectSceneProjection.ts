import * as THREE from 'three';

import type { ProjectDocument } from '@ashfox/engine-core';

import { addNodeGeometry } from './sceneGeometry';
import {
  createProjectMaterials,
  disposeMaterial
} from './sceneMaterials';
import { applyNodeTransform } from './sceneTransform';
import type {
  ProjectSceneOptions,
  ProjectSceneProjection
} from './sceneTypes';

const disposeObject = (object: THREE.Object3D): void => {
  const mesh = object as THREE.Mesh;
  mesh.geometry?.dispose();
  if (!object.userData.overlay) return;
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : mesh.material
      ? [mesh.material]
      : [];
  for (const material of materials) disposeMaterial(material);
};

const orderedSceneNodes = (document: ProjectDocument) =>
  Object.values(document.scene.nodes).sort((left, right) =>
    left.id.localeCompare(right.id)
  );

export const projectToThreeScene = (
  document: ProjectDocument,
  options: ProjectSceneOptions
): ProjectSceneProjection => {
  const root = new THREE.Group();
  root.name = 'AshfoxProjectScene';
  const objectsByNodeId = new Map<string, THREE.Group>();
  const selectable: THREE.Object3D[] = [];
  const materials = createProjectMaterials(
    document,
    options.assets,
    options.untexturedColor
  );
  const orderedNodes = orderedSceneNodes(document);

  for (const node of orderedNodes) {
    const group = new THREE.Group();
    group.name = node.name;
    group.visible = node.visible;
    group.userData.nodeId = node.id;
    group.userData.kind = node.kind;
    applyNodeTransform(document, node, group);
    objectsByNodeId.set(node.id, group);
    addNodeGeometry(node, group, {
      materials,
      textures: document.textures,
      options,
      selectable
    });
  }

  for (const node of orderedNodes) {
    const group = objectsByNodeId.get(node.id);
    if (!group) continue;
    const parent =
      node.parentId === null ? root : objectsByNodeId.get(node.parentId);
    (parent ?? root).add(group);
  }

  return {
    root,
    objectsByNodeId,
    selectable,
    dispose: () => {
      root.traverse(disposeObject);
      materials.dispose();
    }
  };
};
