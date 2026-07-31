import type {
  ExportPreset,
  ProjectDocument
} from '@ashfox/engine-core';

export type ArtifactKind =
  | 'project'
  | 'target'
  | 'build'
  | 'animation';

export type ArtifactTarget =
  | ExportPreset
  | 'ashfox.generic'
  | 'minecraft.java_block';

export interface ArtifactBinding {
  projectId: string;
  sourceRevision: string;
  target: ArtifactTarget;
  contentHash: string;
}

export interface ArtifactFile extends ArtifactBinding {
  kind: ArtifactKind;
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

export const artifactContentHash = async (
  bytes: Uint8Array
): Promise<string> => {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
};

export const createArtifactBinding = async (
  document: ProjectDocument,
  bytes: Uint8Array
): Promise<ArtifactBinding> => ({
  projectId: document.id,
  sourceRevision: document.revision,
  target: artifactTargetFor(document),
  contentHash: await artifactContentHash(bytes)
});

export const artifactTargetFor = (
  document: ProjectDocument
): ArtifactTarget => {
  switch (document.formatProfile.id) {
    case 'minecraft.bedrock':
      return 'bedrock';
    case 'minecraft.java.geckolib5':
      return 'geckolib5';
    case 'gltf.2':
      return document.formatProfile.container;
    case 'ashfox.generic':
    case 'minecraft.java_block':
      return document.formatProfile.id;
  }
};

export const isArtifactCurrent = (
  document: ProjectDocument,
  artifact: ArtifactFile
): boolean =>
  artifact.projectId === document.id &&
  artifact.sourceRevision === document.revision &&
  artifact.target === artifactTargetFor(document);

export const safeArtifactName = (value: string): string => {
  const normalized = value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
  return normalized || 'ashfox-project';
};
