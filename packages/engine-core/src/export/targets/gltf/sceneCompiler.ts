import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type CubeNode,
  type MeshNode,
  type ProjectDocument,
  type SceneNode,
  type TextureAsset,
  type Vec2,
  type Vec3
} from '../../../model';
import { GltfBinaryWriter } from './binaryWriter';
import type { GltfMesh, GltfNode, GltfPrimitive } from './types';

export interface GltfSceneCompileOptions {
  writer: GltfBinaryWriter;
  materialByTextureId: ReadonlyMap<string, number>;
  unitScale: number;
}

export interface GltfCompiledScene {
  nodes: GltfNode[];
  meshes: GltfMesh[];
  rootNodeIndices: number[];
  nodeIndexById: Map<string, number>;
  restTranslationById: Map<string, [number, number, number]>;
  restRotationById: Map<string, [number, number, number]>;
  restScaleById: Map<string, [number, number, number]>;
}

const FACE_CORNERS: Record<
  CubeFaceDirection,
  (from: Vec3, to: Vec3) => [Vec3, Vec3, Vec3, Vec3]
> = {
  north: (from, to) => [
    [to[0], from[1], from[2]],
    [from[0], from[1], from[2]],
    [from[0], to[1], from[2]],
    [to[0], to[1], from[2]]
  ],
  south: (from, to) => [
    [from[0], from[1], to[2]],
    [to[0], from[1], to[2]],
    [to[0], to[1], to[2]],
    [from[0], to[1], to[2]]
  ],
  east: (from, to) => [
    [to[0], from[1], to[2]],
    [to[0], from[1], from[2]],
    [to[0], to[1], from[2]],
    [to[0], to[1], to[2]]
  ],
  west: (from, to) => [
    [from[0], from[1], from[2]],
    [from[0], from[1], to[2]],
    [from[0], to[1], to[2]],
    [from[0], to[1], from[2]]
  ],
  up: (from, to) => [
    [from[0], to[1], to[2]],
    [to[0], to[1], to[2]],
    [to[0], to[1], from[2]],
    [from[0], to[1], from[2]]
  ],
  down: (from, to) => [
    [from[0], from[1], from[2]],
    [to[0], from[1], from[2]],
    [to[0], from[1], to[2]],
    [from[0], from[1], to[2]]
  ]
};

const FACE_NORMALS: Record<CubeFaceDirection, Vec3> = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0]
};

const multiply = (value: Vec3, scale: number): [number, number, number] => [
  value[0] * scale,
  value[1] * scale,
  value[2] * scale
];

const subtract = (left: Vec3, right: Vec3): [number, number, number] => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2]
];

const add = (left: Vec3, right: Vec3): [number, number, number] => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2]
];

const quaternionFromEuler = (
  rotation: Vec3
): [number, number, number, number] => {
  const x = (rotation[0] * Math.PI) / 360;
  const y = (rotation[1] * Math.PI) / 360;
  const z = (rotation[2] * Math.PI) / 360;
  const sx = Math.sin(x);
  const cx = Math.cos(x);
  const sy = Math.sin(y);
  const cy = Math.cos(y);
  const sz = Math.sin(z);
  const cz = Math.cos(z);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
};

const isIdentityRotation = (rotation: Vec3): boolean =>
  rotation.every((value) => Math.abs(value) <= 0.000001);

const isIdentityScale = (scale: Vec3): boolean =>
  scale.every((value) => Math.abs(value - 1) <= 0.000001);

const rotateUvs = (
  uvs: [Vec2, Vec2, Vec2, Vec2],
  rotation: 0 | 90 | 180 | 270
): [Vec2, Vec2, Vec2, Vec2] => {
  const steps = rotation / 90;
  return uvs.map((_, index) => uvs[(index + steps) % 4]) as [
    Vec2,
    Vec2,
    Vec2,
    Vec2
  ];
};

const compileFaceUvs = (
  texture: TextureAsset | undefined,
  uv: readonly [number, number, number, number] | undefined,
  rotation: 0 | 90 | 180 | 270
): number[] | undefined => {
  if (!texture || !uv) return undefined;
  const values = rotateUvs(
    [
      [uv[0], uv[3]],
      [uv[2], uv[3]],
      [uv[2], uv[1]],
      [uv[0], uv[1]]
    ],
    rotation
  );
  return values.flatMap(([u, v]) => [
    u / texture.width,
    1 - v / texture.height
  ]);
};

const createPrimitive = (
  writer: GltfBinaryWriter,
  positions: readonly number[],
  normals: readonly number[],
  uvs: readonly number[] | undefined,
  material: number | undefined,
  indices: readonly number[]
): GltfPrimitive => ({
  attributes: {
    POSITION: writer.addFloatAccessor(positions, 3, true, 34962),
    NORMAL: writer.addFloatAccessor(normals, 3, false, 34962),
    ...(uvs
      ? { TEXCOORD_0: writer.addFloatAccessor(uvs, 2, false, 34962) }
      : {})
  },
  indices: writer.addIndexAccessor(indices),
  ...(material === undefined ? {} : { material }),
  mode: 4
});

const compileCubeMesh = (
  document: ProjectDocument,
  cube: CubeNode,
  options: GltfSceneCompileOptions
): GltfMesh => {
  const pivot = cube.transform.pivot;
  const from = cube.bounds.from.map(
    (value, index) => value - pivot[index] - cube.inflate
  ) as [number, number, number];
  const to = cube.bounds.to.map(
    (value, index) => value - pivot[index] + cube.inflate
  ) as [number, number, number];
  const primitives: GltfPrimitive[] = [];

  for (const direction of CUBE_FACE_DIRECTIONS) {
    const face = cube.faces[direction];
    if (!face.enabled) continue;
    const texture =
      face.textureId === null ? undefined : document.textures[face.textureId];
    const positions = FACE_CORNERS[direction](from, to)
      .flatMap((position) => multiply(position, options.unitScale));
    const normal = FACE_NORMALS[direction];
    const normals = [normal, normal, normal, normal].flatMap((value) => value);
    const uvs = compileFaceUvs(texture, face.uv, face.rotation ?? 0);
    const material =
      face.textureId === null
        ? undefined
        : options.materialByTextureId.get(face.textureId);
    primitives.push(
      createPrimitive(
        options.writer,
        positions,
        normals,
        uvs,
        material,
        [0, 1, 2, 0, 2, 3]
      )
    );
  }

  return {
    name: cube.name,
    primitives
  };
};

const normalize = (value: Vec3): [number, number, number] => {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 0.000001) return [0, 1, 0];
  return [value[0] / length, value[1] / length, value[2] / length];
};

const polygonNormal = (vertices: readonly Vec3[]): [number, number, number] => {
  const result: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    result[0] += (current[1] - next[1]) * (current[2] + next[2]);
    result[1] += (current[2] - next[2]) * (current[0] + next[0]);
    result[2] += (current[0] - next[0]) * (current[1] + next[1]);
  }
  return normalize(result);
};

const triangulatePolygon = (
  vertices: readonly Vec3[],
  normal: Vec3
): number[] => {
  if (vertices.length === 3) return [0, 1, 2];
  const dominantAxis =
    Math.abs(normal[0]) >= Math.abs(normal[1]) &&
    Math.abs(normal[0]) >= Math.abs(normal[2])
      ? 0
      : Math.abs(normal[1]) >= Math.abs(normal[2])
        ? 1
        : 2;
  const projected = vertices.map((vertex): Vec2 =>
    dominantAxis === 0
      ? [vertex[1], vertex[2]]
      : dominantAxis === 1
        ? [vertex[0], vertex[2]]
        : [vertex[0], vertex[1]]
  );
  const signedArea = projected.reduce((area, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0);
  const winding = signedArea >= 0 ? 1 : -1;
  const remaining = projected.map((_, index) => index);
  const triangles: number[] = [];
  const cross = (a: Vec2, b: Vec2, c: Vec2): number =>
    (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0]);
  const contains = (
    point: Vec2,
    a: Vec2,
    b: Vec2,
    c: Vec2
  ): boolean => {
    const ab = cross(a, b, point) * winding;
    const bc = cross(b, c, point) * winding;
    const ca = cross(c, a, point) * winding;
    return ab >= -0.000001 && bc >= -0.000001 && ca >= -0.000001;
  };

  let guard = vertices.length * vertices.length;
  while (remaining.length > 3 && guard > 0) {
    guard -= 1;
    let earFound = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const previousIndex =
        remaining[(index - 1 + remaining.length) % remaining.length];
      const currentIndex = remaining[index];
      const nextIndex = remaining[(index + 1) % remaining.length];
      const a = projected[previousIndex];
      const b = projected[currentIndex];
      const c = projected[nextIndex];
      if (cross(a, b, c) * winding <= 0.000001) continue;
      if (
        remaining.some(
          (candidate) =>
            candidate !== previousIndex &&
            candidate !== currentIndex &&
            candidate !== nextIndex &&
            contains(projected[candidate], a, b, c)
        )
      ) {
        continue;
      }
      triangles.push(previousIndex, currentIndex, nextIndex);
      remaining.splice(index, 1);
      earFound = true;
      break;
    }
    if (!earFound) break;
  }
  if (remaining.length === 3) {
    triangles.push(remaining[0], remaining[1], remaining[2]);
  }
  if (triangles.length === (vertices.length - 2) * 3) return triangles;

  const fallback: number[] = [];
  for (let index = 1; index < vertices.length - 1; index += 1) {
    fallback.push(0, index, index + 1);
  }
  return fallback;
};

const compileMesh = (
  document: ProjectDocument,
  mesh: MeshNode,
  options: GltfSceneCompileOptions
): GltfMesh => {
  const primitives: GltfPrimitive[] = [];
  const pivot = mesh.transform.pivot;
  for (const face of Object.values(mesh.faces).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const vertices = face.vertexIds
      .map((vertexId) => mesh.vertices[vertexId])
      .filter((vertex) => vertex !== undefined);
    if (vertices.length < 3) continue;
    const vertexPositions = vertices.map((vertex) => vertex.position);
    const normal = polygonNormal(vertexPositions);
    const positions = vertices.flatMap((vertex) =>
      multiply(subtract(vertex.position, pivot), options.unitScale)
    );
    const normals = vertices.flatMap(() => normal);
    const texture =
      face.textureId === null ? undefined : document.textures[face.textureId];
    const uvs = texture &&
      face.vertexIds.every((vertexId) => face.uv[vertexId] !== undefined)
      ? face.vertexIds.flatMap((vertexId) => {
          const uv = face.uv[vertexId];
          if (!uv) return [];
          return [uv[0] / texture.width, 1 - uv[1] / texture.height];
        })
      : undefined;
    const indices = triangulatePolygon(vertexPositions, normal);
    const primitive = createPrimitive(
      options.writer,
      positions,
      normals,
      uvs,
      face.textureId === null
        ? undefined
        : options.materialByTextureId.get(face.textureId),
      indices
    );
    primitives.push(primitive);
  }
  return {
    name: mesh.name,
    primitives
  };
};

const parentOrigin = (
  document: ProjectDocument,
  node: SceneNode
): [number, number, number] => {
  if (node.parentId === null) return [0, 0, 0];
  const parent = document.scene.nodes[node.parentId];
  if (!parent || parent.kind !== 'bone') return [0, 0, 0];
  return add(parent.transform.pivot, parent.transform.position);
};

const restTranslation = (
  document: ProjectDocument,
  node: SceneNode,
  unitScale: number
): [number, number, number] => {
  if (node.kind === 'locator') {
    return multiply(node.transform.position, unitScale);
  }
  const origin = add(node.transform.pivot, node.transform.position);
  return multiply(subtract(origin, parentOrigin(document, node)), unitScale);
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
  const orderedNodes = Object.values(document.scene.nodes).sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  for (const node of orderedNodes) {
    const translation = restTranslation(document, node, options.unitScale);
    const gltfNode: GltfNode = {
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
    };
    if (node.visible && node.kind === 'cube') {
      gltfNode.mesh = meshes.length;
      meshes.push(compileCubeMesh(document, node, options));
    } else if (node.visible && node.kind === 'mesh') {
      gltfNode.mesh = meshes.length;
      meshes.push(compileMesh(document, node, options));
    }
    nodeIndexById.set(node.id, nodes.length);
    restTranslationById.set(node.id, translation);
    restRotationById.set(node.id, [
      node.transform.rotation[0],
      node.transform.rotation[1],
      node.transform.rotation[2]
    ]);
    restScaleById.set(node.id, [
      node.transform.scale[0],
      node.transform.scale[1],
      node.transform.scale[2]
    ]);
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
