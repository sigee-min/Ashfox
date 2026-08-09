import {
  exportProductionProject,
  exportProductionProjectResolved,
  staleGeneratedTextureIds,
  type BlobRef,
  type ExportAdapterInput,
  type ExportAdaptationReceipt,
  type ExportBundle,
  type ExportFile,
  type MinecraftGameVersion,
  type ProjectDocument,
  type ResolvedBlob,
  type TextureAsset
} from '@ashfox/engine-core';

import { renderTextureRaster } from '../../rendering/renderTextureRaster';
import {
  type ProjectAsset,
  type ProjectAssets
} from '../../application/projectAssets';
import { createStoredZip } from './zip';
import {
  artifactContentHash,
  createArtifactBinding,
  safeArtifactName,
  type ArtifactFile
} from './artifactFile';

const UNSYNCHRONIZED_TEXTURE_MESSAGE =
  'Generated texture derivations are not current. Finish the canonical project command before creating a file.';

export interface TargetArtifactFile extends ArtifactFile {
  kind: 'target';
  sourceFileCount: number;
  gameVersion: MinecraftGameVersion | null;
  adaptationCount: number;
  adaptations: ExportAdaptationReceipt;
}

const assertArtifactDocumentReady = (
  document: ProjectDocument
): void => {
  if (staleGeneratedTextureIds(document).size > 0) {
    throw new Error(UNSYNCHRONIZED_TEXTURE_MESSAGE);
  }
};

const textureForSource = (
  document: ProjectDocument,
  source: BlobRef
): TextureAsset | undefined =>
  Object.values(document.textures).find(
    (texture) =>
      texture.source.bucket === source.bucket &&
      texture.source.key === source.key
  );

const canvasPng = async (
  document: ProjectDocument,
  texture: TextureAsset
): Promise<Uint8Array> => {
  const canvas = renderTextureRaster(document, texture);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Texture PNG encoding failed.'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
};

const generatedPng = async (
  document: ProjectDocument,
  texture: TextureAsset
): Promise<ProjectAsset> => {
  if (texture.source.contentType !== 'image/png') {
    throw new Error(
      `Texture "${texture.name}" requires imported ${texture.source.contentType} bytes.`
    );
  }
  return {
    bytes: await canvasPng(document, texture),
    contentType: 'image/png'
  };
};

const resolveTextureAsset = async (
  document: ProjectDocument,
  texture: TextureAsset,
  assets: ProjectAssets
): Promise<ProjectAsset> => {
  if (texture.atlasMode === 'generate' || texture.raster) {
    return generatedPng(document, texture);
  }
  const stored = assets[texture.id];
  if (!stored) {
    throw new Error(
      `Preserved texture "${texture.name}" is missing its imported bytes.`
    );
  }
  if (stored.contentType !== texture.source.contentType) {
    throw new Error(
      `Preserved texture "${texture.name}" MIME type does not match its source metadata.`
    );
  }
  const bytes = new Uint8Array(stored.bytes);
  if (
    bytes.byteLength === 0 ||
    (
      texture.source.byteLength !== undefined &&
      texture.source.byteLength !== bytes.byteLength
    )
  ) {
    throw new Error(
      `Preserved texture "${texture.name}" byte length does not match its source metadata.`
    );
  }
  if (await artifactContentHash(bytes) !== texture.source.contentHash) {
    throw new Error(
      `Preserved texture "${texture.name}" content hash does not match its source metadata.`
    );
  }
  return {
    contentType: stored.contentType,
    bytes
  };
};

const resolveTexture = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  source: BlobRef
): Promise<ResolvedBlob | null> => {
  const texture = textureForSource(document, source);
  return texture
    ? resolveTextureAsset(document, texture, assets)
    : null;
};

const withoutGeneratedRasterLengths = (
  document: ProjectDocument
): ProjectDocument => ({
  ...document,
  textures: Object.fromEntries(
    Object.entries(document.textures).map(([id, texture]) => [
      id,
      texture.raster
        ? {
            ...texture,
            source: {
              bucket: texture.source.bucket,
              key: texture.source.key,
              contentType: texture.source.contentType,
              contentHash: texture.source.contentHash
            }
          }
        : texture
    ])
  )
});

const createExportBundle = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  adapter: ExportAdapterInput
): Promise<{
  document: ProjectDocument;
  bundle: ExportBundle;
}> => {
  assertArtifactDocumentReady(document);
  const exportDocument = withoutGeneratedRasterLengths(
    document
  );
  const bundle = adapter.target === 'gltf' || adapter.target === 'glb'
    ? await exportProductionProjectResolved(exportDocument, adapter, {
        resolveBlob: (source) =>
          resolveTexture(exportDocument, assets, source)
      })
    : exportProductionProject(exportDocument, adapter);
  return {
    document: exportDocument,
    bundle
  };
};

const fileBytes = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  file: ExportFile
): Promise<Uint8Array> => {
  switch (file.kind) {
    case 'json':
      return new TextEncoder().encode(file.text);
    case 'binary':
      return file.data;
    case 'blob-copy': {
      const resolved = await resolveTexture(document, assets, file.source);
      if (!resolved) {
        throw new Error(`Texture source for "${file.path}" is unavailable.`);
      }
      return resolved.bytes;
    }
  }
};

const extensionForBundle = (bundle: ExportBundle): string =>
  bundle.files.length === 1
    ? bundle.files[0].path.split('.').at(-1) ?? 'bin'
    : 'zip';

const adaptationCount = (
  adaptations: ExportAdaptationReceipt
): number =>
  adaptations.converted.length + adaptations.omitted.length;

export const createTargetArtifact = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  adapter: ExportAdapterInput
): Promise<TargetArtifactFile> => {
  const prepared = await createExportBundle(document, assets, adapter);
  const { bundle } = prepared;
  const gameVersion = adapter.gameVersion ?? null;
  const entries = await Promise.all(
    bundle.files.map(async (file) => ({
      path: file.path,
      bytes: await fileBytes(prepared.document, assets, file)
    }))
  );
  const name = safeArtifactName(document.name);
  if (entries.length === 1) {
    const file = bundle.files[0];
    const bytes = entries[0].bytes;
    return {
      ...await createArtifactBinding(prepared.document, bytes, adapter.target),
      kind: 'target',
      name: `${name}.${extensionForBundle(bundle)}`,
      bytes,
      contentType: file.contentType,
      sourceFileCount: 1,
      gameVersion,
      adaptationCount: adaptationCount(bundle.adaptations),
      adaptations: bundle.adaptations
    };
  }
  const bytes = createStoredZip(entries);
  return {
    ...await createArtifactBinding(prepared.document, bytes, adapter.target),
    kind: 'target',
    name:
      `${name}-${safeArtifactName(bundle.target.id)}` +
      `${gameVersion === null ? '' : `-${safeArtifactName(gameVersion)}`}` +
      '.zip',
    bytes,
    contentType: 'application/zip',
    sourceFileCount: entries.length,
    gameVersion,
    adaptationCount: adaptationCount(bundle.adaptations),
    adaptations: bundle.adaptations
  };
};
