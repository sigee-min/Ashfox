import type {
  ProjectDocument,
  SceneNode
} from '../../../model';
import {
  effectivelyVisibleSceneNodeIds
} from '../../../sceneVisibility';
import { compileGltfCubeMesh } from './cubeMeshCompiler';
import { compileGltfPolygonMesh } from './polygonMeshCompiler';
import {
  addVec3,
  isIdentityRotation,
  isIdentityScale,
  multiplyVec3,
  quaternionFromEuler,
  subtractVec3
} from './sceneMath';
import type {
  GltfCompiledScene,
  GltfSceneCompileOptions
} from './sceneTypes';
import type { GltfMesh, GltfNode } from './types';

export type {
  GltfCompiledScene,
  GltfSceneCompileOptions
} from './sceneTypes';

const parentOrigin = (
  document: ProjectDocument,
  node: SceneNode
): [number, number, number] => {
  if (node.parentId === null) return [0, 0, 0];
  const parent = document.scene.nodes[node.parentId];
  if (!parent || parent.kind !== 'bone') return [0, 0, 0];
  return addVec3(parent.transform.pivot, parent.transform.position);
};

const restTranslation = (
  document: ProjectDocument,
  node: SceneNode,
  unitScale: number
): [number, number, number] => {
  if (node.kind === 'locator') {
    return multiplyVec3(node.transform.position, unitScale);
  }
  const origin = addVec3(node.transform.pivot, node.transform.position);
  return multiplyVec3(
    subtractVec3(origin, parentOrigin(document, node)),
    unitScale
  );
};

const createGltfNode = (
  node: SceneNode,
  translation: [number, number, number]
): GltfNode => ({
  name: node.name,
  ...(translation.some((value) => Math.abs(value) > 0.000001)
    ? { translation }
    : {}),
  ...(!isIdentityRotation(node.transform.rotation)
    ? { rotation: quaternionFromEuler(node.transform.rotation) }
    : {}),
  ...(!isIdentityScale(node.transform.scale)
    ? {
        scale: [
          node.transform.scale[0],
          node.transform.scale[1],
          node.transform.scale[2]
        ] as [number, number, number]
      }
    : {}),
  extras: {
    ashfoxId: node.id,
    ashfoxKind: node.kind,
    visible: node.visible,
    ...(node.tags ? { ashfoxTags: [...node.tags] } : {})
  }
});

const compileNodeMesh = (
  document: ProjectDocument,
  node: SceneNode,
  options: GltfSceneCompileOptions
): GltfMesh | null => {
  switch (node.kind) {
    case 'cube':
      return compileGltfCubeMesh(document, node, options);
    case 'mesh':
      return compileGltfPolygonMesh(document, node, options);
    case 'bone':
    case 'locator':
      return null;
  }
};

export const compileGltfScene = (
  document: ProjectDocument,
  options: GltfSceneCompileOptions
): GltfCompiledScene => {
  const nodes: GltfNode[] = [];
  const meshes: GltfMesh[] = [];
  const nodeIndexById = new Map<string, number>();
  const restTranslationById = new Map<string, [number, number, number]>();
  const restRotationById = new Map<string, [number, number, number]>();
  const restScaleById = new Map<string, [number, number, number]>();
  const visibleNodeIds = effectivelyVisibleSceneNodeIds(document);
  const orderedNodes = Object.values(document.scene.nodes)
    .filter((node) => visibleNodeIds.has(node.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const node of orderedNodes) {
    const translation = restTranslation(document, node, options.unitScale);
    const gltfNode = createGltfNode(node, translation);
    const mesh = compileNodeMesh(document, node, options);
    if (mesh) {
      gltfNode.mesh = meshes.length;
      meshes.push(mesh);
    }
    nodeIndexById.set(node.id, nodes.length);
    restTranslationById.set(node.id, translation);
    restRotationById.set(node.id, [...node.transform.rotation]);
    restScaleById.set(node.id, [...node.transform.scale]);
    nodes.push(gltfNode);
  }

  for (const node of orderedNodes) {
    if (node.parentId === null) continue;
    const parentIndex = nodeIndexById.get(node.parentId);
    const childIndex = nodeIndexById.get(node.id);
    if (parentIndex === undefined || childIndex === undefined) continue;
    const parentNode = nodes[parentIndex];
    parentNode.children = [...(parentNode.children ?? []), childIndex];
  }

  const rootNodeIndices = document.scene.roots
    .map((id) => nodeIndexById.get(id))
    .filter((index): index is number => index !== undefined);

  return {
    nodes,
    meshes,
    rootNodeIndices,
    nodeIndexById,
    restTranslationById,
    restRotationById,
    restScaleById
  };
};
