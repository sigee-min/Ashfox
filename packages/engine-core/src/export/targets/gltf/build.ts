import type { AssetId } from '../../../model';
import type {
  BlobCopyExportFile,
  ResolvedBlob
} from '../../contract';
import type { GltfDocument } from './contract';

export interface GltfBuildOptions {
  resolvedTextures?: ReadonlyMap<AssetId, ResolvedBlob>;
}

export interface CompiledGltf {
  document: GltfDocument;
  binary: Uint8Array;
  textureFiles: BlobCopyExportFile[];
}
