import type {
  AssetBuildIdentity,
  ExportAdaptationReceipt
} from '@ashfox/engine-core';
import type {
  VisibleExportPreset
} from '../../../application/projectExportTarget';

type ExportAdaptation = ExportAdaptationReceipt['converted'][number];

export type ArtifactKind =
  | 'project'
  | 'target'
  | 'build';

export type ArtifactTarget = VisibleExportPreset | 'project' | 'capture';

/** A delivery artifact is bound to the exact immutable build, not source keys. */
export interface ArtifactLineage {
  readonly packageName: AssetBuildIdentity['packageName'];
  readonly entryName: AssetBuildIdentity['entryName'];
  readonly entryPath: AssetBuildIdentity['path'];
  readonly workspaceHash: AssetBuildIdentity['workspaceHash'];
  readonly closureHash: AssetBuildIdentity['closureHash'];
  readonly buildKey: AssetBuildIdentity['buildKey'];
  readonly compilerFingerprint: AssetBuildIdentity['compilerFingerprint'];
  readonly productHash: AssetBuildIdentity['productHash'];
  readonly target: ArtifactTarget;
  readonly targetVersion: string | null;
  readonly artifactSha256: string;
  readonly captureSha256: string | null;
}

export interface ArtifactBinding {
  readonly projectId: string;
  readonly revision: string;
  readonly target: ArtifactTarget;
  readonly targetVersion: string | null;
  readonly contentHash: string;
  readonly lineage?: ArtifactLineage;
}

export interface ArtifactFile extends ArtifactBinding {
  readonly kind: ArtifactKind;
  readonly name: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

export interface TargetArtifactData extends ArtifactFile {
  readonly kind: 'target';
  readonly target: VisibleExportPreset;
  readonly targetVersion: string;
  readonly lineage: ArtifactLineage;
  readonly sourceFileCount: number;
  readonly adaptationCount: number;
  readonly adaptations: ExportAdaptationReceipt;
}

const targetArtifactKeys = Object.freeze([
  'adaptationCount', 'adaptations', 'bytes', 'contentHash', 'contentType',
  'kind', 'lineage', 'name', 'projectId', 'revision', 'sourceFileCount',
  'target', 'targetVersion'
].sort());

const lineageKeys = Object.freeze([
  'artifactSha256', 'buildKey', 'captureSha256', 'closureHash',
  'compilerFingerprint', 'entryName', 'entryPath', 'packageName',
  'productHash', 'target', 'targetVersion', 'workspaceHash'
].sort());

const adaptationRequiredKeys = Object.freeze(['code', 'message', 'path']);
const adaptationOptionalKeys = Object.freeze([
  'channelId', 'clipId', 'keyframeId', 'triggerId'
]);

const exactDataValues = (
  value: unknown,
  expectedKeys: readonly string[]
): Readonly<Record<string, unknown>> | null => {
  if (typeof value !== 'object' || value === null) return null;
  try {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string') ||
      JSON.stringify([...keys].sort()) !== JSON.stringify(
        [...expectedKeys].sort())) return null;
    const result: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable ||
        !('value' in descriptor)) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
};

const exactArrayValues = (value: unknown): readonly unknown[] | null => {
  if (!Array.isArray(value)) return null;
  try {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) ||
      lengthDescriptor.enumerable || !Number.isSafeInteger(
        lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value as number;
    const expected = [...Array.from({ length }, (_, index) => String(index)),
      'length'];
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string') ||
      JSON.stringify([...keys].sort()) !== JSON.stringify(expected.sort())) {
      return null;
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable ||
        !('value' in descriptor)) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
};

export const snapshotLineage = (
  value: unknown
): ArtifactLineage | null => {
  const data = exactDataValues(value, lineageKeys);
  if (data === null ||
    ![data.packageName, data.entryName, data.entryPath,
      data.compilerFingerprint, data.targetVersion, data.target,
      data.artifactSha256, data.captureSha256].every(
        (entry) => entry === null || typeof entry === 'string') ||
    ![data.workspaceHash, data.closureHash, data.buildKey,
      data.productHash].every((entry) => typeof entry === 'string')) {
    return null;
  }
  return Object.freeze({
    packageName: data.packageName as string,
    entryName: data.entryName as string,
    entryPath: data.entryPath as string,
    workspaceHash: data.workspaceHash as AssetBuildIdentity['workspaceHash'],
    closureHash: data.closureHash as AssetBuildIdentity['closureHash'],
    buildKey: data.buildKey as AssetBuildIdentity['buildKey'],
    compilerFingerprint: data.compilerFingerprint as string,
    productHash: data.productHash as AssetBuildIdentity['productHash'],
    target: data.target as ArtifactTarget,
    targetVersion: data.targetVersion as string | null,
    artifactSha256: data.artifactSha256 as string,
    captureSha256: data.captureSha256 as string | null
  });
};

const snapshotAdaptation = (value: unknown): ExportAdaptation | null => {
  if (typeof value !== 'object' || value === null) return null;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return null;
  }
  if (keys.some((key) => typeof key !== 'string') ||
    !adaptationRequiredKeys.every((key) => keys.includes(key)) ||
    keys.some((key) => typeof key === 'string' &&
      !adaptationRequiredKeys.includes(key) &&
      !adaptationOptionalKeys.includes(key))) return null;
  const data = exactDataValues(value, keys as string[]);
  if (data === null || Object.values(data).some(
    (entry) => typeof entry !== 'string')) return null;
  return Object.freeze({
    code: data.code as string,
    path: data.path as string,
    message: data.message as string,
    ...(typeof data.clipId === 'string' ? { clipId: data.clipId } : {}),
    ...(typeof data.channelId === 'string'
      ? { channelId: data.channelId } : {}),
    ...(typeof data.triggerId === 'string'
      ? { triggerId: data.triggerId } : {}),
    ...(typeof data.keyframeId === 'string'
      ? { keyframeId: data.keyframeId } : {})
  });
};

const snapshotAdaptations = (
  value: unknown
): ExportAdaptationReceipt | null => {
  const data = exactDataValues(value, ['converted', 'omitted']);
  if (data === null) return null;
  const converted = exactArrayValues(data.converted);
  const omitted = exactArrayValues(data.omitted);
  if (converted === null || omitted === null) return null;
  const convertedSnapshot = converted.map(snapshotAdaptation);
  const omittedSnapshot = omitted.map(snapshotAdaptation);
  if (convertedSnapshot.some((entry) => entry === null) ||
    omittedSnapshot.some((entry) => entry === null)) return null;
  return Object.freeze({
    omitted: Object.freeze(omittedSnapshot) as readonly ExportAdaptation[],
    converted: Object.freeze(convertedSnapshot) as readonly ExportAdaptation[]
  });
};

export const readTargetArtifact = (
  artifact: unknown,
  requireFrozenNesting = false
): TargetArtifactData | null => {
  const data = exactDataValues(artifact, targetArtifactKeys);
  if (data === null || data.kind !== 'target' ||
    !['bedrock', 'geckolib5', 'java_block', 'glb', 'gltf'].includes(
      String(data.target)) || typeof data.targetVersion !== 'string' ||
    typeof data.projectId !== 'string' || typeof data.revision !== 'string' ||
    typeof data.contentHash !== 'string' || typeof data.name !== 'string' ||
    typeof data.contentType !== 'string' ||
    !(data.bytes instanceof Uint8Array) ||
    !Number.isSafeInteger(data.sourceFileCount) ||
    !Number.isSafeInteger(data.adaptationCount)) return null;
  const lineage = snapshotLineage(data.lineage);
  const adaptations = snapshotAdaptations(data.adaptations);
  if (lineage === null || adaptations === null) return null;
  const rawAdaptations = data.adaptations as ExportAdaptationReceipt;
  const rawEntries = requireFrozenNesting &&
    Array.isArray(rawAdaptations?.converted) &&
    Array.isArray(rawAdaptations?.omitted)
    ? [...rawAdaptations.converted, ...rawAdaptations.omitted] : [];
  if (requireFrozenNesting &&
      (!Object.isFrozen(data.lineage) || !Object.isFrozen(data.adaptations) ||
        !Object.isFrozen(rawAdaptations.converted) ||
        !Object.isFrozen(rawAdaptations.omitted) ||
        rawEntries.some((entry) => !Object.isFrozen(entry)))) return null;
  return {
    projectId: data.projectId as string,
    revision: data.revision as string,
    target: data.target as VisibleExportPreset,
    targetVersion: data.targetVersion as string,
    contentHash: data.contentHash as string,
    kind: 'target',
    name: data.name as string,
    contentType: data.contentType as string,
    bytes: data.bytes as Uint8Array,
    sourceFileCount: data.sourceFileCount as number,
    adaptationCount: data.adaptationCount as number,
    lineage: requireFrozenNesting
      ? data.lineage as ArtifactLineage : lineage,
    adaptations: requireFrozenNesting ? rawAdaptations : adaptations
  };
};
