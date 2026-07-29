import {
  exportProject,
  exportProjectResolved,
  type BlobRef,
  type ExportBundle,
  type ExportFile,
  type ProjectDocument,
  type ResolvedBlob,
  type TextureAsset
} from '@ashfox/engine-core';

import { renderTextureRaster } from '../textures/renderTextureRaster';
import {
  createProjectArchive,
  readProjectArchive,
  type ProjectArchiveFile
} from './projectArchive';
import {
  type ProjectAsset,
  type ProjectAssets
} from './projectAssets';
import { createStoredZip } from './zip';
import {
  safeArtifactName,
  type ArtifactFile
} from './artifactFile';

const ASHFOX_CONTENT_TYPE = 'application/vnd.ashfox.project+zip';

export interface TargetArtifactFile extends ArtifactFile {
  kind: 'target';
  sourceFileCount: number;
}

export const parseProjectFile = async (
  file: File
): Promise<ProjectArchiveFile> => {
  if (!file.name.toLowerCase().endsWith('.ashfox')) {
    throw new Error('Project files must use the .ashfox extension.');
  }
  return readProjectArchive(new Uint8Array(await file.arrayBuffer()));
};

export const createProjectArtifact = async (
  document: ProjectDocument,
  assets: ProjectAssets
): Promise<ArtifactFile> => {
  const bytes = await createProjectArchive(
    document,
    (texture) => resolveTextureAsset(texture, assets)
  );
  return {
    kind: 'project',
    name: `${safeArtifactName(document.name)}.ashfox`,
    bytes,
    contentType: ASHFOX_CONTENT_TYPE
  };
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
  texture: TextureAsset
): Promise<Uint8Array> => {
  const canvas = renderTextureRaster(texture);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Texture PNG encoding failed.'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
};

const generatedPng = async (
  texture: TextureAsset
): Promise<ProjectAsset> => {
  if (texture.source.contentType !== 'image/png') {
    throw new Error(
      `Texture "${texture.name}" requires imported ${texture.source.contentType} bytes.`
    );
  }
  return {
    bytes: await canvasPng(texture),
    contentType: 'image/png'
  };
};

const resolveTextureAsset = async (
  texture: TextureAsset,
  assets: ProjectAssets
): Promise<ProjectAsset> => {
  if (texture.raster) return generatedPng(texture);
  const stored = assets[texture.id];
  if (stored) {
    return {
      contentType: stored.contentType,
      bytes: new Uint8Array(stored.bytes)
    };
  }
  return generatedPng(texture);
};

const resolveTexture = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  source: BlobRef
): Promise<ResolvedBlob | null> => {
  const texture = textureForSource(document, source);
  return texture ? resolveTextureAsset(texture, assets) : null;
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
  assets: ProjectAssets
): Promise<ExportBundle> => {
  const exportDocument = withoutGeneratedRasterLengths(document);
  return exportDocument.formatProfile.id === 'gltf.2'
    ? exportProjectResolved(exportDocument, {
        resolveBlob: (source) =>
          resolveTexture(exportDocument, assets, source)
      })
    : exportProject(exportDocument);
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

export const createTargetArtifact = async (
  document: ProjectDocument,
  assets: ProjectAssets
): Promise<TargetArtifactFile> => {
  const bundle = await createExportBundle(document, assets);
  const entries = await Promise.all(
    bundle.files.map(async (file) => ({
      path: file.path,
      bytes: await fileBytes(document, assets, file)
    }))
  );
  const name = safeArtifactName(document.name);
  if (entries.length === 1) {
    const file = bundle.files[0];
    return {
      kind: 'target',
      name: `${name}.${extensionForBundle(bundle)}`,
      bytes: entries[0].bytes,
      contentType: file.contentType,
      sourceFileCount: 1
    };
  }
  return {
    kind: 'target',
    name: `${name}-${safeArtifactName(bundle.target.id)}.zip`,
    bytes: createStoredZip(entries),
    contentType: 'application/zip',
    sourceFileCount: entries.length
  };
};
