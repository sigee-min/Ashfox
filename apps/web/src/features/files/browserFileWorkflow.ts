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
import { selectProjectFile } from './browserFilePicker';
import {
  createProjectArchive,
  readProjectArchive,
  type AshfoxProjectFile
} from './projectArchive';
import {
  type ProjectAsset,
  type ProjectAssets
} from './projectAssets';
import { createStoredZip } from './zip';

const ASHFOX_CONTENT_TYPE = 'application/vnd.ashfox.project+zip';

const safeFileName = (value: string): string => {
  const normalized = value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
  return normalized || 'ashfox-project';
};

const downloadBytes = (
  name: string,
  bytes: Uint8Array,
  contentType: string
): void => {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  window.document.body.append(anchor);
  try {
    anchor.click();
  } catch (error: unknown) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    anchor.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const openProjectFile = async (): Promise<AshfoxProjectFile | null> => {
  const file = await selectProjectFile();
  if (!file) return null;
  return parseProjectFile(file);
};

export const parseProjectFile = async (
  file: File
): Promise<AshfoxProjectFile> => {
  if (!file.name.toLowerCase().endsWith('.ashfox')) {
    throw new Error('Project files must use the .ashfox extension.');
  }
  return readProjectArchive(new Uint8Array(await file.arrayBuffer()));
};

export const downloadProjectFile = async (
  document: ProjectDocument,
  assets: ProjectAssets
): Promise<void> => {
  const bytes = await createProjectArchive(
    document,
    (texture) => resolveTextureAsset(texture, assets)
  );
  downloadBytes(
    `${safeFileName(document.name)}.ashfox`,
    bytes,
    ASHFOX_CONTENT_TYPE
  );
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

export const downloadTargetExport = async (
  document: ProjectDocument,
  assets: ProjectAssets
): Promise<ExportBundle> => {
  const bundle = await createExportBundle(document, assets);
  const entries = await Promise.all(
    bundle.files.map(async (file) => ({
      path: file.path,
      bytes: await fileBytes(document, assets, file)
    }))
  );
  const name = safeFileName(document.name);
  if (entries.length === 1) {
    const file = bundle.files[0];
    downloadBytes(
      `${name}.${extensionForBundle(bundle)}`,
      entries[0].bytes,
      file.contentType
    );
    return bundle;
  }
  downloadBytes(
    `${name}-${safeFileName(bundle.target.id)}.zip`,
    createStoredZip(entries),
    'application/zip'
  );
  return bundle;
};
