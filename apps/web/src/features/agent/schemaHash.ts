import { canonicalJsonString } from '@ashfox/engine-core';

export const schemaHash = (schema: unknown): string => {
  const source = canonicalJsonString(schema);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
