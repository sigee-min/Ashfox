import type {
  ProjectDocument,
  SceneNode,
  Vec3
} from '../../../model';
import {
  composeMat4,
  IDENTITY_MAT4,
  invertAffineMat4,
  multiplyMat4,
  transformPointMat4,
  type Mat4
} from './matrixMath';
import {
  mergeGltfPrimitiveData,
  type GltfPrimitiveData
} from './primitiveData';
import { compileGltfPrimitive } from './primitiveCompiler';
import {
  bakeGltfPrimitiveToParent,
  primitiveDataForGltfNode
} from './rigidBatchCompiler';
import { quaternionFromEuler } from './sceneMath';
import type { GltfSceneCompileOptions } from './sceneTypes';
import type { GltfMesh, GltfNode, GltfSkin } from './types';

interface OwnedPrimitive {
  ownerId: string;
  primitive: GltfPrimitiveData;
}

interface PrimitiveBatch {
  material: number | undefined;
  hasUvs: boolean;
  primitives: GltfPrimitiveData[];
}

export interface CompiledGlobalBatch {
  mesh: GltfMesh;
  meshNode: Pick<GltfNode, 'mesh' | 'skin' | 'translation' | 'scale'>;
  skin?: GltfSkin;
}

const animatedNodeIds = (document: ProjectDocument): ReadonlySet<string> =>
  new Set(
    Object.values(document.animations).flatMap((clip) =>
      Object.values(clip.channels).map((channel) => channel.targetNodeId)
    )
  );

const ownerIsAnimated = (
  document: ProjectDocument,
  ownerId: string,
  animated: ReadonlySet<string>
): boolean => {
  let node: SceneNode | undefined = document.scene.nodes[ownerId];
  const visited = new Set<string>();
  while (node && !visited.has(node.id)) {
    if (animated.has(node.id)) return true;
    visited.add(node.id);
    node = node.parentId === null
      ? undefined
      : document.scene.nodes[node.parentId];
  }
  return false;
};

const collectOwnedPrimitives = (
  document: ProjectDocument,
  nodes: readonly SceneNode[],
  restTranslations: ReadonlyMap<string, Vec3>,
  options: GltfSceneCompileOptions
): OwnedPrimitive[] => {
  const animated = animatedNodeIds(document);
  const result: OwnedPrimitive[] = [];
  for (const node of nodes) {
    if (node.kind !== 'cube' && node.kind !== 'mesh') continue;
    const ownerId = node.parentId !== null && !animated.has(node.id)
      ? node.parentId
      : node.id;
    const bake = ownerId !== node.id;
    const translation = restTranslations.get(node.id) ?? [0, 0, 0];
    for (const source of primitiveDataForGltfNode(document, node, options)) {
      result.push({
        ownerId,
        primitive: bake
          ? bakeGltfPrimitiveToParent(node, translation, source)
          : source
      });
    }
  }
  return result;
};

const globalBindMatrices = (
  document: ProjectDocument,
  nodes: readonly SceneNode[],
  restTranslations: ReadonlyMap<string, Vec3>
): ReadonlyMap<string, Mat4> => {
  const visibleIds = new Set(nodes.map((node) => node.id));
  const local = new Map(
    nodes.map((node) => [
      node.id,
      composeMat4(
        restTranslations.get(node.id) ?? [0, 0, 0],
        quaternionFromEuler(node.transform.rotation),
        node.transform.scale
      )
    ] as const)
  );
  const result = new Map<string, Mat4>();
  const resolve = (nodeId: string): Mat4 => {
    const existing = result.get(nodeId);
    if (existing) return existing;
    const node = document.scene.nodes[nodeId];
    const parent = node?.parentId;
    const parentMatrix = parent !== null && parent !== undefined &&
      visibleIds.has(parent)
      ? resolve(parent)
      : IDENTITY_MAT4;
    const matrix = multiplyMat4(parentMatrix, local.get(nodeId) ?? IDENTITY_MAT4);
    result.set(nodeId, matrix);
    return matrix;
  };
  for (const node of nodes) resolve(node.id);
  return result;
};

const transformedNormal = (
  inverse: Mat4,
  normal: Vec3
): [number, number, number] | null => {
  const value: [number, number, number] = [
    inverse[0] * normal[0] + inverse[1] * normal[1] + inverse[2] * normal[2],
    inverse[4] * normal[0] + inverse[5] * normal[1] + inverse[6] * normal[2],
    inverse[8] * normal[0] + inverse[9] * normal[1] + inverse[10] * normal[2]
  ];
  const length = Math.hypot(...value);
  return length <= 1e-12
    ? null
    : value.map((component) => component / length) as [number, number, number];
};

const primitiveInModelSpace = (
  source: GltfPrimitiveData,
  matrix: Mat4,
  inverse: Mat4
): GltfPrimitiveData | null => {
  const positions: number[] = [];
  const normals: number[] = [];
  for (let offset = 0; offset < source.positions.length; offset += 3) {
    positions.push(...transformPointMat4(matrix, [
      source.positions[offset],
      source.positions[offset + 1],
      source.positions[offset + 2]
    ]));
    const normal = transformedNormal(inverse, [
      source.normals[offset],
      source.normals[offset + 1],
      source.normals[offset + 2]
    ]);
    if (!normal) return null;
    normals.push(...normal);
  }
  return {
    ...source,
    positions,
    normals
  };
};

const decodeTransform = (
  primitives: readonly GltfPrimitiveData[],
  maximumError: number
): {
  center: [number, number, number];
  extent: number;
  matrix: Mat4;
  normalized: boolean;
} => {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const primitive of primitives) {
    for (let offset = 0; offset < primitive.positions.length; offset += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], primitive.positions[offset + axis]);
        max[axis] = Math.max(max[axis], primitive.positions[offset + axis]);
      }
    }
  }
  const center = min.map(
    (value, axis) => (value + max[axis]) / 2
  ) as [number, number, number];
  const extent = Math.max(
    ...min.map((value, axis) => (max[axis] - value) / 2),
    1e-9
  );
  const normalized = extent / 32767 <= maximumError;
  if (!normalized) {
    return {
      center: [0, 0, 0],
      extent: 1,
      matrix: IDENTITY_MAT4,
      normalized: false
    };
  }
  return {
    center,
    extent,
    matrix: composeMat4(center, [0, 0, 0, 1], [extent, extent, extent]),
    normalized: true
  };
};

const normalizedPrimitive = (
  primitive: GltfPrimitiveData,
  joint: number | undefined,
  center: Vec3,
  extent: number
): GltfPrimitiveData => ({
  ...primitive,
  positions: primitive.positions.map(
    (value, index) => (value - center[index % 3]) / extent
  ),
  ...(joint === undefined
    ? {}
    : {
        joints: new Array<number>(primitive.positions.length / 3).fill(joint)
      })
});

const batchKey = (
  material: number | undefined,
  hasUvs: boolean
): string => `${material ?? 'none'}:${hasUvs ? 'uv' : 'plain'}`;

const compareBatches = (left: PrimitiveBatch, right: PrimitiveBatch): number =>
  (left.material ?? -1) - (right.material ?? -1) ||
  Number(left.hasUvs) - Number(right.hasUvs);

export const compileGlobalGltfBatch = (
  document: ProjectDocument,
  orderedNodes: readonly SceneNode[],
  nodeIndexById: ReadonlyMap<string, number>,
  restTranslations: ReadonlyMap<string, Vec3>,
  options: GltfSceneCompileOptions
): CompiledGlobalBatch | null => {
  const owned = collectOwnedPrimitives(
    document,
    orderedNodes,
    restTranslations,
    options
  );
  if (owned.length === 0) return null;
  const globals = globalBindMatrices(document, orderedNodes, restTranslations);
  const ownerSet = new Set(owned.map(({ ownerId }) => ownerId));
  const ownerIds = orderedNodes
    .map((node) => node.id)
    .filter((nodeId) => ownerSet.has(nodeId));
  const animated = animatedNodeIds(document);
  const requiresSkin = ownerIds.some((ownerId) =>
    ownerIsAnimated(document, ownerId, animated)
  );
  if (requiresSkin && (ownerIds.length <= 1 || ownerIds.length > 65536)) {
    return null;
  }
  const inverseByOwner = new Map<string, Mat4>();
  for (const ownerId of ownerIds) {
    const matrix = globals.get(ownerId);
    const inverse = matrix ? invertAffineMat4(matrix) : null;
    if (!inverse || nodeIndexById.get(ownerId) === undefined) return null;
    inverseByOwner.set(ownerId, inverse);
  }
  const modelPrimitives: OwnedPrimitive[] = [];
  for (const entry of owned) {
    const matrix = globals.get(entry.ownerId);
    const inverse = inverseByOwner.get(entry.ownerId);
    if (!matrix || !inverse) return null;
    const primitive = primitiveInModelSpace(entry.primitive, matrix, inverse);
    if (!primitive) return null;
    modelPrimitives.push({ ownerId: entry.ownerId, primitive });
  }
  const decode = decodeTransform(
    modelPrimitives.map(({ primitive }) => primitive),
    options.unitScale / 1024
  );
  const jointByOwner = new Map(ownerIds.map((ownerId, joint) => [ownerId, joint]));
  const batches = new Map<string, PrimitiveBatch>();
  for (const entry of modelPrimitives) {
    const joint = requiresSkin
      ? jointByOwner.get(entry.ownerId)
      : undefined;
    if (requiresSkin && joint === undefined) return null;
    const primitive = normalizedPrimitive(
      entry.primitive,
      joint,
      decode.center,
      decode.extent
    );
    const key = batchKey(primitive.material, primitive.uvs !== undefined);
    const batch = batches.get(key) ?? {
      material: primitive.material,
      hasUvs: primitive.uvs !== undefined,
      primitives: []
    };
    batch.primitives.push(primitive);
    batches.set(key, batch);
  }
  const primitives = [...batches.values()].sort(compareBatches).map((batch) => {
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
  const mesh: GltfMesh = {
    name: `${document.name} ${requiresSkin ? 'rigid skin' : 'static'} batch`,
    primitives
  };
  if (!requiresSkin) {
    return {
      mesh,
      meshNode: {
        mesh: 0,
        ...(decode.normalized
          ? {
              translation: decode.center,
              scale: [
                decode.extent,
                decode.extent,
                decode.extent
              ] as [number, number, number]
            }
          : {})
      }
    };
  }
  const inverseBindMatrices = ownerIds.flatMap((ownerId) =>
    [...multiplyMat4(inverseByOwner.get(ownerId)!, decode.matrix)]
  );
  return {
    mesh,
    meshNode: { mesh: 0, skin: 0 },
    skin: {
      name: `${document.name} rigid skin`,
      inverseBindMatrices: options.writer.addFloatMatrixAccessor(
        inverseBindMatrices
      ),
      joints: ownerIds.map((ownerId) => nodeIndexById.get(ownerId)!)
    }
  };
};
