import type {
  AssetId,
  ProjectDocument,
  TextureAsset
} from '../../../model';
import {
  BlobResolutionError,
  ExportMaterializationRequiredError,
  type BlobResolver,
  type ResolvedBlob
} from '../../contract';

export interface GltfResolvedExportOptions {
  resolveBlob: BlobResolver;
}

export const orderedTextures = (
  document: ProjectDocument
): TextureAsset[] =>
  Object.values(document.textures).sort((left, right) =>
    left.id.localeCompare(right.id)
  );

export const validateResolvedTexture = (
  texture: TextureAsset,
  resolved: ResolvedBlob
): ResolvedBlob => {
  if (!(resolved.bytes instanceof Uint8Array)) {
    throw new BlobResolutionError(
      'blob.invalid_bytes',
      texture.id,
      texture.source,
      `Resolved texture "${texture.id}" did not provide Uint8Array bytes.`
    );
  }
  if (resolved.contentType !== texture.source.contentType) {
    throw new BlobResolutionError(
      'blob.content_type_mismatch',
      texture.id,
      texture.source,
      `Resolved texture "${texture.id}" has content type "${resolved.contentType}", expected "${texture.source.contentType}".`
    );
  }
  if (
    texture.source.byteLength !== undefined &&
    resolved.bytes.byteLength !== texture.source.byteLength
  ) {
    throw new BlobResolutionError(
      'blob.byte_length_mismatch',
      texture.id,
      texture.source,
      `Resolved texture "${texture.id}" has ${resolved.bytes.byteLength} bytes, expected ${texture.source.byteLength}.`
    );
  }
  return resolved;
};

export const requireResolvedTexture = (
  texture: TextureAsset,
  resolvedTextures: ReadonlyMap<AssetId, ResolvedBlob> | undefined
): ResolvedBlob => {
  const resolved = resolvedTextures?.get(texture.id);
  if (!resolved) {
    throw new ExportMaterializationRequiredError(
      `Embedded GLB export requires resolved bytes for texture "${texture.id}".`
    );
  }
  return validateResolvedTexture(texture, resolved);
};

const resolveTexture = async (
  texture: TextureAsset,
  resolveBlob: BlobResolver
): Promise<readonly [AssetId, ResolvedBlob]> => {
  let resolved: ResolvedBlob | null;
  try {
    resolved = await resolveBlob(texture.source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BlobResolutionError(
      'blob.read_failed',
      texture.id,
      texture.source,
      `Failed to resolve texture "${texture.id}": ${reason}`
    );
  }
  if (!resolved) {
    throw new BlobResolutionError(
      'blob.not_found',
      texture.id,
      texture.source,
      `Texture blob "${texture.source.bucket}/${texture.source.key}" was not found.`
    );
  }
  validateResolvedTexture(texture, resolved);
  return [texture.id, resolved];
};

export const resolveGltfTextures = async (
  document: ProjectDocument,
  resolveBlob: BlobResolver
): Promise<ReadonlyMap<AssetId, ResolvedBlob>> => {
  const entries = await Promise.all(
    orderedTextures(document).map((texture) =>
      resolveTexture(texture, resolveBlob)
    )
  );
  return new Map(entries);
};
