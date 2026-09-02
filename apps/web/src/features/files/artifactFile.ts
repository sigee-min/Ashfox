import {
  canonicalJsonString,
  exportPresetForBundle,
  isAssetProjectAuthorityValid,
  type AssetProject,
  type ExportAdaptationReceipt,
  type ExportBundle,
  type ProjectDocument
} from '@ashfox/engine-core';
import { verifyExportBundleForProject } from '@ashfox/engine-core';

import type { VisibleExportPreset } from '../../application/projectExportTarget';
import { sha256DigestSync } from './artifactDigest';
import { createStoredZip, readStoredZip } from './zip';
import {
  readTargetArtifact,
  snapshotLineage,
  type ArtifactBinding,
  type ArtifactFile,
  type ArtifactLineage,
  type ArtifactTarget,
  type TargetArtifactData
} from './artifact/contract';

export type {
  ArtifactBinding,
  ArtifactFile,
  ArtifactLineage
} from './artifact/contract';
export { exportPresetForBundle } from '@ashfox/engine-core';

type GeneralArtifactTarget = 'project' | 'capture';
type TargetArtifactSeal = Readonly<{
  project: AssetProject;
  projectId: string;
  revision: string;
  target: VisibleExportPreset;
  targetVersion: string;
  contentHash: string;
  name: string;
  contentType: string;
  metadataDigest: string;
  lineage: ArtifactLineage;
  adaptations: ExportAdaptationReceipt;
  documentDigest: string;
  buildDigest: string;
}>;

const sealedTargetArtifacts = new WeakMap<object, TargetArtifactSeal>();
const preparedTargetDocuments = new WeakMap<object, Readonly<{
  source: ProjectDocument;
  sourceDigest: string;
  preparedDigest: string;
}>>();

const documentStateDigest = (document: ProjectDocument): string =>
  sha256DigestSync(new TextEncoder().encode(canonicalJsonString(document)));

const buildStateDigest = (project: AssetProject): string =>
  sha256DigestSync(new TextEncoder().encode(canonicalJsonString(project.build)));

/** Creates the delivery projection for raster bytes without changing authority. */
export const prepareTargetArtifactDocument = (
  document: ProjectDocument
): ProjectDocument => {
  const prepared: ProjectDocument = {
    ...document,
    textures: Object.fromEntries(Object.entries(document.textures).map(
      ([id, texture]) => [id, texture.raster ? {
        ...texture,
        source: {
          bucket: texture.source.bucket,
          key: texture.source.key,
          contentType: texture.source.contentType,
          contentHash: texture.source.contentHash
        }
      } : texture]))
  };
  preparedTargetDocuments.set(prepared, Object.freeze({
    source: document,
    sourceDigest: documentStateDigest(document),
    preparedDigest: documentStateDigest(prepared)
  }));
  return prepared;
};

const targetMetadataDigest = (target: TargetArtifactData): string =>
  sha256DigestSync(new TextEncoder().encode(JSON.stringify({
    sourceFileCount: target.sourceFileCount,
    adaptationCount: target.adaptationCount,
    adaptations: target.adaptations
  })));

const safeArtifactName = (value: string): string => {
  const normalized = value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
  return normalized || 'ashfox-project';
};

const validTargetArtifactMetadata = (
  document: ProjectDocument,
  artifact: TargetArtifactData,
  bundle: ExportBundle,
  entryCount: number
): boolean => {
  const adaptations = bundle.adaptations;
  const count = adaptations.converted.length + adaptations.omitted.length;
  const versionSuffix = ['bedrock', 'geckolib5', 'java_block'].includes(
    artifact.target) ? `-${safeArtifactName(bundle.target.version)}` : '';
  const expectedName = `${safeArtifactName(document.name)}-${safeArtifactName(
    bundle.target.id)}${versionSuffix}.zip`;
  return artifact.contentType === 'application/zip' &&
    artifact.name === expectedName &&
    artifact.sourceFileCount === entryCount &&
    artifact.adaptationCount === count &&
    JSON.stringify(artifact.adaptations) === JSON.stringify(adaptations);
};

export const artifactContentHash = async (
  bytes: Uint8Array
): Promise<string> => {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

const buildLineage = (
  project: AssetProject,
  target: ArtifactTarget,
  targetVersion: string | null,
  contentHash: string
): ArtifactLineage => ({
  packageName: project.build.packageName,
  entryName: project.build.entryName,
  entryPath: project.build.path,
  workspaceHash: project.build.workspaceHash,
  closureHash: project.build.closureHash,
  buildKey: project.build.buildKey,
  compilerFingerprint: project.build.compilerFingerprint,
  productHash: project.build.productHash,
  target,
  targetVersion,
  artifactSha256: contentHash,
  captureSha256: target === 'capture' ? contentHash : null
});

export const createArtifactBinding = async (
  project: AssetProject,
  bytes: Uint8Array,
  target: GeneralArtifactTarget = 'project'
): Promise<ArtifactBinding> => {
  if (target !== 'project' && target !== 'capture') {
    throw new TypeError('Target exports require a compiler-sealed bundle.');
  }
  const contentHash = await artifactContentHash(bytes);
  return {
    projectId: project.id,
    revision: project.revision,
    target,
    targetVersion: null,
    contentHash,
    lineage: buildLineage(project, target, null, contentHash)
  };
};

const sameBuildLineage = (
  lineage: ArtifactLineage,
  project: AssetProject,
  target: ArtifactTarget,
  targetVersion: string | null
): boolean => lineage.packageName === project.build.packageName &&
  lineage.entryName === project.build.entryName &&
  lineage.entryPath === project.build.path &&
  lineage.workspaceHash === project.build.workspaceHash &&
  lineage.closureHash === project.build.closureHash &&
  lineage.buildKey === project.build.buildKey &&
  lineage.compilerFingerprint === project.build.compilerFingerprint &&
  lineage.productHash === project.build.productHash &&
  lineage.target === target && lineage.targetVersion === targetVersion;

const sameBuildIdentity = (
  lineage: Readonly<{
    readonly packageName: string;
    readonly entryName: string;
    readonly entryPath: string;
    readonly workspaceHash: string;
    readonly closureHash: string;
    readonly buildKey: string;
    readonly compilerFingerprint: string;
    readonly productHash: string;
  }>,
  project: AssetProject
): boolean => lineage.packageName === project.build.packageName &&
  lineage.entryName === project.build.entryName &&
  lineage.entryPath === project.build.path &&
  lineage.workspaceHash === project.build.workspaceHash &&
  lineage.closureHash === project.build.closureHash &&
  lineage.buildKey === project.build.buildKey &&
  lineage.compilerFingerprint === project.build.compilerFingerprint &&
  lineage.productHash === project.build.productHash;

const targetSealFor = (
  project: AssetProject,
  artifact: ArtifactFile,
  bundle: ExportBundle,
  bundleDocument: ProjectDocument
): TargetArtifactSeal | null => {
  const targetArtifact = readTargetArtifact(artifact, true);
  if (targetArtifact === null) return null;
  const prepared = preparedTargetDocuments.get(bundleDocument);
  const validDocumentRelationship = bundleDocument === project.document || (
    prepared?.source === project.document &&
    prepared.sourceDigest === documentStateDigest(project.document) &&
    prepared.preparedDigest === documentStateDigest(bundleDocument));
  if (!validDocumentRelationship ||
    !verifyExportBundleForProject(bundle, project) ||
    exportPresetForBundle(bundle) !== targetArtifact.target ||
    targetArtifact.targetVersion !== bundle.target.version ||
    bundle.lineage.projectId !== project.id ||
    bundle.lineage.revision !== project.revision ||
    targetArtifact.projectId !== project.id ||
    targetArtifact.revision !== project.revision ||
    targetArtifact.contentHash !== sha256DigestSync(targetArtifact.bytes)) return null;
  let entries: ReturnType<typeof readStoredZip>;
  try {
    entries = readStoredZip(targetArtifact.bytes);
  } catch {
    return null;
  }
  const canonicalZip = createStoredZip(entries);
  if (canonicalZip.length !== targetArtifact.bytes.length || canonicalZip.some(
    (value, index) => value !== targetArtifact.bytes[index])) return null;
  if (!validTargetArtifactMetadata(project.document, targetArtifact, bundle,
    entries.length)) return null;
  const manifests = entries.filter((entry) => entry.path === 'ashfox-lineage.json');
  const bundleManifest = bundle.files.filter((entry) => entry.path === 'ashfox-lineage.json');
  if (manifests.length !== 1 || bundleManifest.length !== 1 ||
    bundleManifest[0]?.kind !== 'json' ||
    new Set(entries.map((entry) => entry.path)).size !== entries.length ||
    entries.some((entry, index) => entry.path !== bundle.files[index]?.path) ||
    entries.length !== bundle.files.length) return null;
  const manifestText = new TextDecoder().decode(manifests[0]!.bytes);
  if (manifestText !== bundleManifest[0].text) return null;
  const inventory = new Map(bundle.lineage.files.map((entry) =>
    [entry.path, entry] as const));
  if (inventory.size !== bundle.lineage.files.length ||
    inventory.size !== entries.length - 1) return null;
  for (const entry of entries) {
    if (entry.path === 'ashfox-lineage.json') continue;
    const expected = inventory.get(entry.path);
    if (expected === undefined || expected.byteLength !== entry.bytes.length ||
      expected.sha256 !== sha256DigestSync(entry.bytes)) return null;
  }
  const lineage = targetArtifact.lineage;
  if (!sameBuildLineage(lineage, project, targetArtifact.target,
    bundle.target.version) ||
    !sameBuildIdentity(bundle.lineage, project) ||
    lineage.artifactSha256 !== targetArtifact.contentHash ||
    lineage.captureSha256 !== null) return null;
  return Object.freeze({
    project,
    projectId: project.id,
    revision: project.revision,
    target: targetArtifact.target,
    targetVersion: bundle.target.version,
    contentHash: targetArtifact.contentHash,
    name: targetArtifact.name,
    contentType: targetArtifact.contentType,
    metadataDigest: targetMetadataDigest(targetArtifact),
    lineage: targetArtifact.lineage,
    adaptations: targetArtifact.adaptations,
    documentDigest: documentStateDigest(project.document),
    buildDigest: buildStateDigest(project)
  });
};

const sealTargetNesting = (artifact: ArtifactFile): boolean => {
  const data = readTargetArtifact(artifact);
  if (data === null) return false;
  const lineageDescriptor = Object.getOwnPropertyDescriptor(artifact, 'lineage');
  const adaptationsDescriptor = Object.getOwnPropertyDescriptor(artifact, 'adaptations');
  if (lineageDescriptor === undefined || !('value' in lineageDescriptor) ||
    lineageDescriptor.writable !== true || adaptationsDescriptor === undefined ||
    !('value' in adaptationsDescriptor) || adaptationsDescriptor.writable !== true) {
    return false;
  }
  Object.defineProperty(artifact, 'lineage', { ...lineageDescriptor, value: data.lineage });
  Object.defineProperty(artifact, 'adaptations', { ...adaptationsDescriptor, value: data.adaptations });
  return readTargetArtifact(artifact, true) !== null;
};

/** Seal bytes against the exact AssetProject and compiler bundle. */
export const sealTargetArtifact = <T extends ArtifactFile>(
  project: AssetProject,
  artifact: T,
  bundle: ExportBundle,
  bundleDocument: ProjectDocument = project.document
): T => {
  if (!sealTargetNesting(artifact)) throw new TypeError(
    'Target artifact metadata does not match the exact immutable contract.');
  const seal = targetSealFor(project, artifact, bundle, bundleDocument);
  if (seal === null) throw new TypeError(
    'Target artifact bytes do not match the sealed export bundle.');
  sealedTargetArtifacts.set(artifact, seal);
  return artifact;
};

export const isArtifactCurrent = (
  project: AssetProject,
  artifact: ArtifactFile
): boolean => {
  if (!isAssetProjectAuthorityValid(project)) return false;
  const kindDescriptor = Object.getOwnPropertyDescriptor(artifact, 'kind');
  if (kindDescriptor === undefined || !kindDescriptor.enumerable ||
    !('value' in kindDescriptor)) return false;
  const lineage = snapshotLineage(artifact.lineage);
  const base = artifact.projectId === project.id &&
    artifact.revision === project.revision &&
    lineage !== null &&
    sameBuildLineage(lineage, project, artifact.target, artifact.targetVersion) &&
    lineage.artifactSha256 === artifact.contentHash &&
    lineage.captureSha256 === (artifact.target === 'capture' ? artifact.contentHash : null) &&
    artifact.contentHash === sha256DigestSync(artifact.bytes);
  if (!base) return false;
  if (kindDescriptor.value !== 'target') return true;
  const target = readTargetArtifact(artifact, true);
  const seal = sealedTargetArtifacts.get(artifact);
  return target !== null && seal !== undefined && seal.project === project &&
    seal.projectId === project.id && seal.revision === project.revision &&
    seal.contentHash === target.contentHash && seal.target === target.target &&
    seal.targetVersion === target.targetVersion && seal.name === target.name &&
    seal.contentType === target.contentType &&
    seal.metadataDigest === targetMetadataDigest(target) &&
    seal.lineage === target.lineage && seal.adaptations === target.adaptations &&
    seal.documentDigest === documentStateDigest(project.document) &&
    seal.buildDigest === buildStateDigest(project);
};

export { safeArtifactName };
