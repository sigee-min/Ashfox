import type {
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  ProjectAssets
} from '../../application/projectAssets';

export interface AssetMaterializationIssue {
  textureId: string;
  code:
    | 'bytes_missing'
    | 'bytes_empty'
    | 'content_type_mismatch'
    | 'byte_length_mismatch';
}

export interface AssetMaterializationReport {
  materialized: boolean;
  preservedTextures: number;
  verifiedMetadata: number;
  issues: readonly AssetMaterializationIssue[];
  contentHashVerification: 'deferred_to_export';
}

export const evaluateAssetMaterialization = (
  document: ProjectDocument,
  assets: ProjectAssets
): AssetMaterializationReport => {
  const issues: AssetMaterializationIssue[] = [];
  const preserved = Object.values(document.textures).filter(
    (texture) => texture.atlasMode !== 'generate' && !texture.raster
  );
  let verifiedMetadata = 0;
  for (const texture of preserved) {
    const asset = assets[texture.id];
    if (!asset) {
      issues.push({
        textureId: texture.id,
        code: 'bytes_missing'
      });
      continue;
    }
    if (asset.bytes.byteLength === 0) {
      issues.push({
        textureId: texture.id,
        code: 'bytes_empty'
      });
      continue;
    }
    if (asset.contentType !== texture.source.contentType) {
      issues.push({
        textureId: texture.id,
        code: 'content_type_mismatch'
      });
      continue;
    }
    if (
      texture.source.byteLength !== undefined &&
      texture.source.byteLength !== asset.bytes.byteLength
    ) {
      issues.push({
        textureId: texture.id,
        code: 'byte_length_mismatch'
      });
      continue;
    }
    verifiedMetadata += 1;
  }
  return {
    materialized: issues.length === 0,
    preservedTextures: preserved.length,
    verifiedMetadata,
    issues,
    contentHashVerification: 'deferred_to_export'
  };
};
