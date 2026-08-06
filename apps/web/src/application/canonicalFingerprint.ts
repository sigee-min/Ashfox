import { canonicalJsonString } from '@ashfox/engine-core';

/* Deterministic local-integrity checksum; this is not a security signature. */
export const canonicalFingerprint = (value: unknown): string => {
  const source = canonicalJsonString(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
