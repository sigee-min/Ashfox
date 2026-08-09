export interface GltfPrimitiveData {
  positions: readonly number[];
  normals: readonly number[];
  uvs?: readonly number[];
  joints?: readonly number[];
  material?: number;
  indices: readonly number[];
}

export interface MergedGltfPrimitiveData extends GltfPrimitiveData {
  positions: number[];
  normals: number[];
  uvs?: number[];
  joints?: number[];
  indices: number[];
}

const canonicalFloat = (value: number): number => {
  const rounded = Math.fround(value);
  return Object.is(rounded, -0) ? 0 : rounded;
};

const vertexKey = (
  positions: readonly number[],
  normals: readonly number[],
  uvs: readonly number[] | undefined,
  joints: readonly number[] | undefined,
  vertex: number
): string => {
  const values = [
    canonicalFloat(positions[vertex * 3]),
    canonicalFloat(positions[vertex * 3 + 1]),
    canonicalFloat(positions[vertex * 3 + 2]),
    canonicalFloat(normals[vertex * 3]),
    canonicalFloat(normals[vertex * 3 + 1]),
    canonicalFloat(normals[vertex * 3 + 2])
  ];
  if (uvs) {
    values.push(
      canonicalFloat(uvs[vertex * 2]),
      canonicalFloat(uvs[vertex * 2 + 1])
    );
  }
  if (joints) values.push(joints[vertex]);
  return values.join(',');
};

const assertPrimitiveData = (primitive: GltfPrimitiveData): number => {
  if (primitive.positions.length % 3 !== 0) {
    throw new Error('glTF primitive positions must contain VEC3 values.');
  }
  const vertexCount = primitive.positions.length / 3;
  if (primitive.normals.length !== vertexCount * 3) {
    throw new Error('glTF primitive normals must match position count.');
  }
  if (primitive.uvs && primitive.uvs.length !== vertexCount * 2) {
    throw new Error('glTF primitive UVs must match position count.');
  }
  if (primitive.joints && primitive.joints.length !== vertexCount) {
    throw new Error('glTF primitive joints must match position count.');
  }
  if (
    primitive.indices.some(
      (index) => !Number.isSafeInteger(index) || index < 0 || index >= vertexCount
    )
  ) {
    throw new Error('glTF primitive indices must reference existing vertices.');
  }
  return vertexCount;
};

export const mergeGltfPrimitiveData = (
  primitives: readonly GltfPrimitiveData[]
): MergedGltfPrimitiveData => {
  if (primitives.length === 0) {
    throw new Error('Cannot merge an empty glTF primitive batch.');
  }
  const material = primitives[0].material;
  const hasUvs = primitives[0].uvs !== undefined;
  const hasJoints = primitives[0].joints !== undefined;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs = hasUvs ? [] as number[] : undefined;
  const joints = hasJoints ? [] as number[] : undefined;
  const indices: number[] = [];
  const vertexByKey = new Map<string, number>();

  for (const primitive of primitives) {
    const vertexCount = assertPrimitiveData(primitive);
    if (
      primitive.material !== material ||
      (primitive.uvs !== undefined) !== hasUvs
      || (primitive.joints !== undefined) !== hasJoints
    ) {
      throw new Error('glTF primitive batch keys do not match.');
    }
    const remap = new Array<number>(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const key = vertexKey(
        primitive.positions,
        primitive.normals,
        primitive.uvs,
        primitive.joints,
        vertex
      );
      const existing = vertexByKey.get(key);
      if (existing !== undefined) {
        remap[vertex] = existing;
        continue;
      }
      const next = positions.length / 3;
      vertexByKey.set(key, next);
      remap[vertex] = next;
      positions.push(
        canonicalFloat(primitive.positions[vertex * 3]),
        canonicalFloat(primitive.positions[vertex * 3 + 1]),
        canonicalFloat(primitive.positions[vertex * 3 + 2])
      );
      normals.push(
        canonicalFloat(primitive.normals[vertex * 3]),
        canonicalFloat(primitive.normals[vertex * 3 + 1]),
        canonicalFloat(primitive.normals[vertex * 3 + 2])
      );
      if (uvs && primitive.uvs) {
        uvs.push(
          canonicalFloat(primitive.uvs[vertex * 2]),
          canonicalFloat(primitive.uvs[vertex * 2 + 1])
        );
      }
      if (joints && primitive.joints) joints.push(primitive.joints[vertex]);
    }
    for (const index of primitive.indices) indices.push(remap[index]);
  }

  return {
    positions,
    normals,
    ...(uvs ? { uvs } : {}),
    ...(joints ? { joints } : {}),
    ...(material === undefined ? {} : { material }),
    indices
  };
};
