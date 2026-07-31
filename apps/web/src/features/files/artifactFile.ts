import type {
  ProjectDocument
} from '@ashfox/engine-core';
import {
  projectExportTargetFor,
  type ProjectArtifactTarget
} from '../../application/projectExportTarget';

export type ArtifactKind =
  | 'project'
  | 'target'
  | 'build'
  | 'animation';

export type ArtifactTarget = ProjectArtifactTarget;

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
  target: projectExportTargetFor(document).target,
  contentHash: await artifactContentHash(bytes)
});

export const isArtifactCurrent = (
  document: ProjectDocument,
  artifact: ArtifactFile
): boolean =>
  artifact.projectId === document.id &&
  artifact.sourceRevision === document.revision &&
  artifact.target === projectExportTargetFor(document).target;

export const safeArtifactName = (value: string): string => {
  const normalized = value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
  return normalized || 'ashfox-project';
};
