import type {
  ProjectCommandOperation,
  ProjectDocument
} from '@ashfox/engine-core';

const MINECRAFT_TEXTURE_SEED = 0x41534846;

export const createMinecraftTextureOperation = (
  document: ProjectDocument
): ProjectCommandOperation | null => {
  const hasCube = Object.values(document.scene.nodes)
    .some((node) => node.kind === 'cube');
  if (!hasCube) return null;
  return {
    name: 'textures.uvAtlas.generate',
    payload: {
      target: {
        scope: 'all'
      },
      pixelsPerBlock: 16,
      padding: 1,
      maxResolution: Math.max(
        256,
        document.settings.textureResolution.width,
        document.settings.textureResolution.height
      ),
      seed: MINECRAFT_TEXTURE_SEED,
      intensity: 0.22,
      edge: 0.12,
      noise: 0.06,
      lightDir: 'tl_br'
    }
  };
};
