import type {
  ProjectDocument,
  TextureAsset
} from '../model';
import { resourceToken } from '../resourceToken';
import { SURFACE_SYNTHESIS_VERSION } from './appearance';

export interface CreateTextureAssetInput {
  id: string;
  name: string;
  width?: number;
  height?: number;
  atlasMode?: 'generate' | 'preserve';
  background?: string;
}

export const createTextureAsset = (
  document: ProjectDocument,
  input: CreateTextureAssetInput
): TextureAsset => {
  const ordinal = Object.keys(document.textures).length;
  const projectToken = resourceToken(document.id, 'project');
  const textureToken = resourceToken(input.id, 'texture');
  const background = input.background ?? '#8e98a3';
  const atlasMode = input.atlasMode ?? 'generate';
  return {
    id: input.id,
    name: input.name.trim(),
    width: input.width ?? document.settings.textureResolution.width,
    height: input.height ?? document.settings.textureResolution.height,
    source: {
      bucket: 'textures',
      key: `generated/${projectToken}/${textureToken}-${ordinal}.png`,
      contentType: 'image/png',
      contentHash: `generated:${projectToken}:${textureToken}:${ordinal}`
    },
    visible: true,
    sampling: 'nearest',
    colorSpace: 'srgb',
    renderMode: 'default',
    renderSides: 'double',
    atlasMode,
    pbrChannel: 'color',
    raster: {
      background,
      canvasDetails: []
    },
    metadata: {
      previewColor: background,
      ...(atlasMode === 'generate'
        ? { surfaceSynthesisVersion: SURFACE_SYNTHESIS_VERSION }
        : {})
    }
  };
};

export const implicitTextureId = (
  document: ProjectDocument
): string => {
  const base = 'texture-base';
  const isUsed = (id: string): boolean =>
    document.textures[id] !== undefined ||
    document.scene.nodes[id] !== undefined ||
    document.animations[id] !== undefined;
  if (!isUsed(base)) return base;
  let index = 2;
  while (isUsed(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
};
