import type { GltfBinaryWriter } from './binaryWriter';
import type { GltfMesh, GltfNode } from './types';

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
