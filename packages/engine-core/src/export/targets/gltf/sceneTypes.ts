import type { GltfBinaryWriter } from './binaryWriter';
import type { CubeFaceOcclusion } from '../../shared/cubeFaceOcclusion';
import type { GltfMesh, GltfNode, GltfSkin } from './types';

export interface GltfSceneCompileOptions {
  writer: GltfBinaryWriter;
  materialByTextureId: ReadonlyMap<string, number>;
  unitScale: number;
  cubeFaceOcclusion?: CubeFaceOcclusion;
}

export interface GltfCompiledScene {
  nodes: GltfNode[];
  meshes: GltfMesh[];
  skins: GltfSkin[];
  rootNodeIndices: number[];
  nodeIndexById: Map<string, number>;
  restTranslationById: Map<string, [number, number, number]>;
  restRotationById: Map<string, [number, number, number]>;
  restScaleById: Map<string, [number, number, number]>;
}
