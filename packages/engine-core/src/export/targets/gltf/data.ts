/** One target-local primitive batch before scene assembly. */
export interface GltfPrimitiveData {
  positions: readonly number[];
  normals: readonly number[];
  uvs?: readonly number[];
  joints?: readonly number[];
  material?: number;
  indices: readonly number[];
  sourceNodeId?: string;
}
