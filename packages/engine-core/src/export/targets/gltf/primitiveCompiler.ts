import type { GltfBinaryWriter } from './binaryWriter';
import type { GltfPrimitive } from './types';

export const compileGltfPrimitive = (
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
