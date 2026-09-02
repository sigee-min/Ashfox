import {
  exportProductionProjectResolved,
  type AssetProject,
  type BlobRef,
  type ExportAdapterInput,
  type ExportAdaptationReceipt,
  type ExportBundle,
  type ExportFile,
  type ProjectDocument,
  type ResolvedBlob,
  type TextureAsset
} from '@ashfox/engine-core';

import { renderTextureRaster } from '../../rendering/renderTextureRaster';
import type {
  ProjectAsset,
  ProjectAssets
} from '../../application/projectAssets';
import { createStoredZip } from './zip';
import {
  artifactContentHash,
  exportPresetForBundle,
  createArtifactBinding,
  prepareTargetArtifactDocument,
  safeArtifactName,
  sealTargetArtifact,
  type ArtifactFile
} from './artifactFile';

export interface TargetArtifactFile extends ArtifactFile {
  kind: 'target';
  sourceFileCount: number;
  adaptationCount: number;
  adaptations: ExportAdaptationReceipt;
}

const textureForSource = (
  document: ProjectDocument,
  source: BlobRef
): TextureAsset | undefined => Object.values(document.textures).find(
  (texture) => texture.source.bucket === source.bucket &&
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

const authoredRasterPng = async (
  document: ProjectDocument,
  texture: TextureAsset
): Promise<ProjectAsset> => {
  if (texture.source.contentType !== 'image/png') throw new Error(
    `Authored raster "${texture.name}" requires PNG materialization; received ${texture.source.contentType}.`
  );
  return { bytes: await canvasPng(document, texture), contentType: 'image/png' };
};

const resolveTextureAsset = async (
  document: ProjectDocument,
  texture: TextureAsset,
  assets: ProjectAssets
): Promise<ProjectAsset> => {
  if (texture.raster) return authoredRasterPng(document, texture);
  const stored = assets[texture.id];
  if (!stored) throw new Error(
    `Preserved texture "${texture.name}" is missing its imported bytes.`
  );
  if (stored.contentType !== texture.source.contentType) throw new Error(
    `Preserved texture "${texture.name}" MIME type does not match its source metadata.`
  );
  const bytes = new Uint8Array(stored.bytes);
  if (bytes.byteLength === 0 || texture.source.byteLength !== undefined &&
      texture.source.byteLength !== bytes.byteLength) throw new Error(
    `Preserved texture "${texture.name}" byte length does not match its source metadata.`
  );
  if (await artifactContentHash(bytes) !== texture.source.contentHash) throw new Error(
    `Preserved texture "${texture.name}" content hash does not match its source metadata.`
  );
  return { contentType: stored.contentType, bytes };
};

const resolveTexture = async (
  document: ProjectDocument,
  assets: ProjectAssets,
  source: BlobRef
): Promise<ResolvedBlob | null> => {
  const texture = textureForSource(document, source);
  return texture === undefined ? null : resolveTextureAsset(document, texture, assets);
};

const createExportBundle = async (
  project: AssetProject,
  assets: ProjectAssets,
  adapter: ExportAdapterInput
): Promise<{ document: ProjectDocument; bundle: ExportBundle }> => {
  const document = prepareTargetArtifactDocument(project.document);
  const bundle = await exportProductionProjectResolved(
    project,
    adapter,
    { resolveBlob: (source) => resolveTexture(document, assets, source) }
  );
  return { document, bundle };
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
      if (!resolved) throw new Error(`Texture source for "${file.path}" is unavailable.`);
      return resolved.bytes;
    }
  }
};

const adaptationCount = (adaptations: ExportAdaptationReceipt): number =>
  adaptations.converted.length + adaptations.omitted.length;

const targetArtifactBinding = async (
  project: AssetProject,
  bytes: Uint8Array,
  target: TargetArtifactFile['target'],
  targetVersion: string
): Promise<Pick<TargetArtifactFile, 'projectId' | 'revision' | 'target' |
  'targetVersion' | 'contentHash' | 'lineage'>> => {
  const contentHash = await artifactContentHash(bytes);
  const binding = await createArtifactBinding(project, bytes, 'project');
  return {
    projectId: binding.projectId,
    revision: binding.revision,
    target,
    targetVersion,
    contentHash,
    lineage: {
      ...binding.lineage!,
      target,
      targetVersion,
      artifactSha256: contentHash,
      captureSha256: null
    }
  };
};

export const createTargetArtifact = async (
  project: AssetProject,
  assets: ProjectAssets,
  adapter: ExportAdapterInput
): Promise<TargetArtifactFile> => {
  const prepared = await createExportBundle(project, assets, adapter);
  const { bundle } = prepared;
  const target = exportPresetForBundle(bundle);
  if (target === null) throw new TypeError(
    'The compiler bundle does not identify one exact delivery preset.');
  const targetVersion = bundle.target.version;
  const entries = await Promise.all(bundle.files.map(async (file) => ({
    path: file.path,
    bytes: await fileBytes(prepared.document, assets, file)
  })));
  const bytes = createStoredZip(entries);
  const artifact: TargetArtifactFile = {
    ...await targetArtifactBinding(project, bytes, target, targetVersion),
    kind: 'target',
    name:
      `${safeArtifactName(project.document.name)}-${safeArtifactName(bundle.target.id)}` +
      `${['bedrock', 'geckolib5', 'java_block'].includes(target)
        ? `-${safeArtifactName(targetVersion)}` : ''}.zip`,
    bytes,
    contentType: 'application/zip',
    sourceFileCount: entries.length,
    adaptationCount: adaptationCount(bundle.adaptations),
    adaptations: bundle.adaptations
  };
  return sealTargetArtifact(project, artifact, bundle, prepared.document);
};
