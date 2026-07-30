import {
  unsynchronizedGeneratedTextureIds,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

export const projectNeedsTextureSynchronization = (
  document: ProjectDocument
): boolean =>
  unsynchronizedGeneratedTextureIds(document).size > 0;

export const createTextureSyncOperation = (
  document: ProjectDocument
): ProjectCommandOperation | null => {
  const hasGeneratedFace = Object.values(document.scene.nodes).some(
    (node) =>
      node.kind === 'cube' &&
      Object.values(node.faces).some((face) => {
        if (!face.enabled || face.textureId === null) return false;
        return document.textures[face.textureId]?.atlasMode === 'generate';
      })
  );
  return hasGeneratedFace
    ? {
        name: 'textures.sync',
        payload: {}
      }
    : null;
};
