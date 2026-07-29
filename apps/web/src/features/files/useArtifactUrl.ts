'use client';

import { useEffect, useState } from 'react';

import type { ArtifactFile } from './artifactFile';
import { createArtifactUrl } from './browserArtifactUrl';

export const useArtifactUrl = (
  file: ArtifactFile | null
): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const handle = createArtifactUrl(file);
    setUrl(handle.url);
    return handle.release;
  }, [file]);

  return url;
};
