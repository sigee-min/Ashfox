import type { AssetId } from '../../../model';
import type {
  BlobCopyExportFile,
  ResolvedBlob
} from '../../types';
import type { GltfDocument } from './types';

export interface GltfBuildOptions {
  resolvedTextures?: ReadonlyMap<AssetId, ResolvedBlob>;
}

export interface CompiledGltf {
  document: GltfDocument;
  binary: Uint8Array;
  textureFiles: BlobCopyExportFile[];
}
