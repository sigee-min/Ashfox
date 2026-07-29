import type { ArtifactFile } from './artifactFile';

export interface ArtifactUrlHandle {
  url: string;
  release: () => void;
}

interface ObjectUrlPort {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}

export const createArtifactUrl = (
  file: ArtifactFile,
  objectUrls: ObjectUrlPort = URL
): ArtifactUrlHandle => {
  const bytes = new Uint8Array(file.bytes);
  const url = objectUrls.createObjectURL(
    new Blob([bytes.buffer], { type: file.contentType })
  );
  return {
    url,
    release: () => objectUrls.revokeObjectURL(url)
  };
};
