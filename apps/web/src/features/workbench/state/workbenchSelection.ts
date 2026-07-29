import type { ProjectDocument } from '@ashfox/engine-core';

export const resolveSelectedNodeId = (
  document: ProjectDocument,
  preferredId: string | null
): string | null => {
  if (preferredId === null) return null;
  if (preferredId && document.scene.nodes[preferredId]) {
    return preferredId;
  }
  return (
    document.scene.roots.find((id) => document.scene.nodes[id]) ??
    Object.keys(document.scene.nodes)[0] ??
    null
  );
};

export const resolveActiveClipId = (
  document: ProjectDocument,
  preferredId: string | null
): string | null =>
  preferredId && document.animations[preferredId]
    ? preferredId
    : Object.keys(document.animations)[0] ?? null;
