import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type CubeNode,
  type ProjectDocument,
  type TextureAsset,
  type Vec2,
  type Vec3
} from '../../../model';
import { compileGltfPrimitive } from './primitiveCompiler';
import { multiplyVec3 } from './sceneMath';
import type { GltfSceneCompileOptions } from './sceneTypes';
import type { GltfMesh, GltfPrimitive } from './types';

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

export const compileGltfCubeMesh = (
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
      .flatMap((position) => multiplyVec3(position, options.unitScale));
    const normal = FACE_NORMALS[direction];
    const normals = [normal, normal, normal, normal].flatMap((value) => value);
    const uvs = compileFaceUvs(texture, face.uv, face.rotation ?? 0);
    const material =
      face.textureId === null
        ? undefined
        : options.materialByTextureId.get(face.textureId);
    primitives.push(
      compileGltfPrimitive(
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
