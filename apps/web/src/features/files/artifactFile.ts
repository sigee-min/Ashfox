export type ArtifactKind =
  | 'project'
  | 'target'
  | 'build'
  | 'animation';

export interface ArtifactFile {
  kind: ArtifactKind;
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

export const safeArtifactName = (value: string): string => {
  const normalized = value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
  return normalized || 'ashfox-project';
};
