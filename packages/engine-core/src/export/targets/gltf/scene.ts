import type {
  ProjectDocument,
  SceneNode
} from '../../../model';
import {
  effectivelyVisibleSceneNodeIds
} from '../../../sceneVisibility';
import { compileOpaqueCubeFaceOcclusion } from '../../occlusion/cube';
import { compileRigidGltfBatches } from './rigid';
import { compileGlobalGltfBatch } from './skin';
import {
  addVec3,
  isIdentityRotation,
  isIdentityScale,
  multiplyVec3,
  quaternionFromEuler,
  subtractVec3
} from './spatial';
import type {
  GltfCompiledScene,
  GltfSceneCompileOptions
} from './graph';
import type { GltfNode } from './contract';

export type {
  GltfCompiledScene,
  GltfSceneCompileOptions
} from './graph';

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

export const compileGltfScene = (
  document: ProjectDocument,
  options: GltfSceneCompileOptions
): GltfCompiledScene => {
  const nodes: GltfNode[] = [];
  const nodeIndexById = new Map<string, number>();
  const restTranslationById = new Map<string, [number, number, number]>();
  const restRotationById = new Map<string, [number, number, number]>();
  const restScaleById = new Map<string, [number, number, number]>();
  const visibleNodeIds = effectivelyVisibleSceneNodeIds(document);
  const orderedNodes = Object.values(document.scene.nodes)
    .filter((node) => visibleNodeIds.has(node.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const compileOptions: GltfSceneCompileOptions = {
    ...options,
    cubeFaceOcclusion: compileOpaqueCubeFaceOcclusion(document)
  };

  for (const node of orderedNodes) {
    const translation = restTranslation(document, node, options.unitScale);
    const gltfNode = createGltfNode(node, translation);
    nodeIndexById.set(node.id, nodes.length);
    restTranslationById.set(node.id, translation);
    restRotationById.set(node.id, [...node.transform.rotation]);
    restScaleById.set(node.id, [...node.transform.scale]);
    nodes.push(gltfNode);
  }

  const globalBatch = compileGlobalGltfBatch(
    document,
    orderedNodes,
    nodeIndexById,
    restTranslationById,
    compileOptions
  );
  let meshes = globalBatch ? [globalBatch.mesh] : [];
  const skins = globalBatch?.skin ? [globalBatch.skin] : [];
  let optimizedMeshNode: number | undefined;
  if (globalBatch) {
    optimizedMeshNode = nodes.length;
    nodes.push({
      name: `${document.name} optimized mesh`,
      ...globalBatch.meshNode
    });
  } else {
    const compiledBatches = compileRigidGltfBatches(
      document,
      orderedNodes,
      restTranslationById,
      compileOptions
    );
    meshes = compiledBatches.meshes;
    for (const [ownerId, mesh] of compiledBatches.meshIndexByOwnerId) {
      const nodeIndex = nodeIndexById.get(ownerId);
      if (nodeIndex !== undefined) nodes[nodeIndex].mesh = mesh;
    }
  }

  for (const node of orderedNodes) {
    if (node.parentId === null) continue;
    const parentIndex = nodeIndexById.get(node.parentId);
    const childIndex = nodeIndexById.get(node.id);
    if (parentIndex === undefined || childIndex === undefined) continue;
    const parentNode = nodes[parentIndex];
    parentNode.children = [...(parentNode.children ?? []), childIndex];
  }

  const authoredRootNodeIndices = document.scene.roots
    .map((id) => nodeIndexById.get(id))
    .filter((index): index is number => index !== undefined);
  const rootNodeIndices = [...authoredRootNodeIndices];
  if (optimizedMeshNode !== undefined) rootNodeIndices.push(optimizedMeshNode);

  if (skins.length > 0 && authoredRootNodeIndices.length > 0) {
    if (authoredRootNodeIndices.length === 1) {
      skins[0] = {
        ...skins[0],
        skeleton: authoredRootNodeIndices[0]
      };
    } else {
      const commonRootIndex = nodes.length;
      nodes.push({
        name: `${document.name} common rig root`,
        children: [...authoredRootNodeIndices]
      });
      skins[0] = {
        ...skins[0],
        skeleton: commonRootIndex
      };
      rootNodeIndices.splice(
        0,
        rootNodeIndices.length,
        commonRootIndex,
        ...(optimizedMeshNode === undefined ? [] : [optimizedMeshNode])
      );
    }
  }

  return {
    nodes,
    meshes,
    skins,
    rootNodeIndices,
    nodeIndexById,
    restTranslationById,
    restRotationById,
    restScaleById
  };
};
