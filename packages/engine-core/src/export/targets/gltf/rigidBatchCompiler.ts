import type {
  ProjectDocument,
  SceneNode,
  Vec3
} from '../../../model';
import { compileGltfCubePrimitiveData } from './cubeMeshCompiler';
import { compileGltfPolygonPrimitiveData } from './polygonMeshCompiler';
import { compileGltfPrimitive } from './primitiveCompiler';
import {
  mergeGltfPrimitiveData,
  type GltfPrimitiveData
} from './primitiveData';
import {
  quaternionFromEuler,
  rotateVec3ByQuaternion
} from './sceneMath';
import type { GltfSceneCompileOptions } from './sceneTypes';
import type { GltfMesh } from './types';

interface PrimitiveBatch {
  material: number | undefined;
  hasUvs: boolean;
  primitives: GltfPrimitiveData[];
}

export interface CompiledRigidBatches {
  meshes: GltfMesh[];
  meshIndexByOwnerId: ReadonlyMap<string, number>;
}

const animatedNodeIds = (document: ProjectDocument): ReadonlySet<string> =>
  new Set(
    Object.values(document.animations).flatMap((clip) =>
      Object.values(clip.channels).map((channel) => channel.targetNodeId)
    )
  );

export const primitiveDataForGltfNode = (
  document: ProjectDocument,
  node: SceneNode,
  options: GltfSceneCompileOptions
): GltfPrimitiveData[] => {
  switch (node.kind) {
    case 'cube':
      return compileGltfCubePrimitiveData(document, node, options);
    case 'mesh':
      return compileGltfPolygonPrimitiveData(document, node, options);
    case 'bone':
    case 'locator':
      return [];
  }
};

const normalize = (value: Vec3): [number, number, number] => {
  const length = Math.hypot(value[0], value[1], value[2]);
  return length <= 0.000001
    ? [0, 1, 0]
    : [value[0] / length, value[1] / length, value[2] / length];
};

const inverseScaledNormal = (
  normal: number,
  scale: number
): number => Math.abs(scale) <= 0.000001 ? 0 : normal / scale;

const flipTriangleWinding = (indices: readonly number[]): number[] => {
  const result = [...indices];
  for (let index = 0; index + 2 < result.length; index += 3) {
    const second = result[index + 1];
    result[index + 1] = result[index + 2];
    result[index + 2] = second;
  }
  return result;
};

export const bakeGltfPrimitiveToParent = (
  node: SceneNode,
  translation: Vec3,
  primitive: GltfPrimitiveData
): GltfPrimitiveData => {
  const rotation = quaternionFromEuler(node.transform.rotation);
  const scale = node.transform.scale;
  const positions: number[] = [];
  const normals: number[] = [];
  for (let offset = 0; offset < primitive.positions.length; offset += 3) {
    const position = rotateVec3ByQuaternion(
      [
        primitive.positions[offset] * scale[0],
        primitive.positions[offset + 1] * scale[1],
        primitive.positions[offset + 2] * scale[2]
      ],
      rotation
    );
    positions.push(
      position[0] + translation[0],
      position[1] + translation[1],
      position[2] + translation[2]
    );
    const normal = normalize(
      rotateVec3ByQuaternion(
        [
          inverseScaledNormal(primitive.normals[offset], scale[0]),
          inverseScaledNormal(primitive.normals[offset + 1], scale[1]),
          inverseScaledNormal(primitive.normals[offset + 2], scale[2])
        ],
        rotation
      )
    );
    normals.push(...normal);
  }
  return {
    positions,
    normals,
    ...(primitive.uvs ? { uvs: primitive.uvs } : {}),
    ...(primitive.material === undefined
      ? {}
      : { material: primitive.material }),
    indices:
      scale[0] * scale[1] * scale[2] < 0
        ? flipTriangleWinding(primitive.indices)
        : primitive.indices
  };
};

const batchKey = (
  material: number | undefined,
  hasUvs: boolean
): string => `${material ?? 'none'}:${hasUvs ? 'uv' : 'plain'}`;

const compareBatches = (
  left: PrimitiveBatch,
  right: PrimitiveBatch
): number =>
  (left.material ?? -1) - (right.material ?? -1) ||
  Number(left.hasUvs) - Number(right.hasUvs);

export const compileRigidGltfBatches = (
  document: ProjectDocument,
  orderedNodes: readonly SceneNode[],
  restTranslationById: ReadonlyMap<string, Vec3>,
  options: GltfSceneCompileOptions
): CompiledRigidBatches => {
  const animated = animatedNodeIds(document);
  const batchesByOwner = new Map<string, Map<string, PrimitiveBatch>>();

  for (const node of orderedNodes) {
    if (node.kind !== 'cube' && node.kind !== 'mesh') continue;
    const ownerId =
      node.parentId !== null && !animated.has(node.id)
        ? node.parentId
        : node.id;
    const ownerBatches = batchesByOwner.get(ownerId) ?? new Map();
    const bake = ownerId !== node.id;
    const translation = restTranslationById.get(node.id) ?? [0, 0, 0];
    for (const source of primitiveDataForGltfNode(document, node, options)) {
      const primitive = bake
        ? bakeGltfPrimitiveToParent(node, translation, source)
        : source;
      const key = batchKey(primitive.material, primitive.uvs !== undefined);
      const batch = ownerBatches.get(key) ?? {
        material: primitive.material,
        hasUvs: primitive.uvs !== undefined,
        primitives: []
      };
      batch.primitives.push(primitive);
      ownerBatches.set(key, batch);
    }
    batchesByOwner.set(ownerId, ownerBatches);
  }

  const meshes: GltfMesh[] = [];
  const meshIndexByOwnerId = new Map<string, number>();
  for (const owner of orderedNodes) {
    const batches = batchesByOwner.get(owner.id);
    if (!batches || batches.size === 0) continue;
    const primitives = [...batches.values()]
      .sort(compareBatches)
      .map((batch) => {
        const merged = mergeGltfPrimitiveData(batch.primitives);
        return compileGltfPrimitive(
          options.writer,
          merged.positions,
          merged.normals,
          merged.uvs,
          merged.joints,
          merged.material,
          merged.indices
        );
      });
    meshIndexByOwnerId.set(owner.id, meshes.length);
    meshes.push({
      name: `${owner.name} rigid batch`,
      primitives
    });
  }
  return { meshes, meshIndexByOwnerId };
};
