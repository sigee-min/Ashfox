import type {
  MeshNode,
  ProjectDocument,
  Vec2,
  Vec3
} from '../../../model';
import type { GltfPrimitiveData } from './data';
import {
  multiplyVec3,
  subtractVec3
} from './spatial';
import type { GltfSceneCompileOptions } from './graph';

const normalize = (value: Vec3): [number, number, number] => {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 0.000001) return [0, 1, 0];
  return [value[0] / length, value[1] / length, value[2] / length];
};

const polygonNormal = (
  vertices: readonly Vec3[]
): [number, number, number] => {
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

export const compileGltfPolygonPrimitiveData = (
  document: ProjectDocument,
  mesh: MeshNode,
  options: GltfSceneCompileOptions
): GltfPrimitiveData[] => {
  const primitives: GltfPrimitiveData[] = [];
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
      multiplyVec3(subtractVec3(vertex.position, pivot), options.unitScale)
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
    const material = face.textureId === null
      ? undefined
      : options.materialByTextureId.get(face.textureId);
    primitives.push({
      positions,
      normals,
      ...(uvs ? { uvs } : {}),
      ...(material === undefined ? {} : { material }),
      indices
    });
  }
  return primitives;
};
