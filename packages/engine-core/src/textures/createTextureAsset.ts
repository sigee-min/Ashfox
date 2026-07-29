import type {
  MinecraftTextureBinding,
  ProjectDocument,
  TextureAsset
} from '../model';
import { resourceToken } from '../resourceToken';

export interface CreateTextureAssetInput {
  id: string;
  name: string;
  width?: number;
  height?: number;
  atlasMode?: 'generate' | 'preserve';
  background?: string;
}

export const createMinecraftTextureBinding = (
  location: {
    namespace: string;
    kind: 'block' | 'item' | 'entity';
    modelPath: string;
  },
  id: string,
  ordinal: number
): MinecraftTextureBinding => {
  const token = resourceToken(id, 'texture');
  const suffix = ordinal === 0 ? '' : `_${token}`;
  return {
    key: ordinal === 0 ? 'base' : `${token}_${ordinal}`,
    resource: {
      namespace: location.namespace,
      path: `${location.kind}/${location.modelPath}${suffix}`
    },
    extension: 'png',
    particle: ordinal === 0
  };
};

const textureBinding = (
  document: ProjectDocument,
  id: string,
  ordinal: number
): MinecraftTextureBinding | undefined => {
  const profile = document.formatProfile;
  if (
    profile.id !== 'minecraft.java_block' &&
    profile.id !== 'minecraft.bedrock' &&
    profile.id !== 'minecraft.java.geckolib5'
  ) {
    return undefined;
  }
  return createMinecraftTextureBinding(
    {
      namespace: profile.namespace,
      kind: profile.id === 'minecraft.java_block'
        ? profile.modelKind
        : profile.id === 'minecraft.bedrock'
          ? profile.geometryKind
          : profile.assetKind,
      modelPath: profile.modelPath
    },
    id,
    ordinal
  );
};

export const createTextureAsset = (
  document: ProjectDocument,
  input: CreateTextureAssetInput
): TextureAsset => {
  const ordinal = Object.keys(document.textures).length;
  const projectToken = resourceToken(document.id, 'project');
  const textureToken = resourceToken(input.id, 'texture');
  const background = input.background ?? '#8e98a3';
  const minecraft = textureBinding(document, input.id, ordinal);
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
    atlasMode: input.atlasMode ?? 'generate',
    pbrChannel: 'color',
    ...(minecraft ? { minecraft } : {}),
    raster: {
      background,
      rectangles: []
    },
    metadata: {
      previewColor: background
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
