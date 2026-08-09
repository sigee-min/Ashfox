import type { ExportAdaptedDocument, ExportTextureAsset } from '../../adapter';
import { createCompactJsonExportFile } from '../../json';
import { createExportBundle } from '../../pipeline/bundle';
import { validateExportTarget } from '../../pipeline/validate';
import { buildMinecraftActorAnimation } from '../../minecraft';
import { buildMinecraftGeometry } from '../../minecraft/geometry';
import {
  type BlobCopyExportFile,
  type ExportBundle
} from '../../contract';

const createTextureCopy = (texture: ExportTextureAsset): BlobCopyExportFile => {
  if (!texture.minecraft) {
    throw new Error(`Texture "${texture.id}" has no Minecraft binding.`);
  }
  return {
    kind: 'blob-copy',
    role: 'texture',
    path: `textures/${texture.minecraft.resource.path}.${texture.minecraft.extension}`,
    contentType: texture.source.contentType,
    source: texture.source
  };
};

export const buildMinecraftBedrockGeometry = (document: ExportAdaptedDocument) => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.bedrock') {
    throw new Error('Project does not use the minecraft.bedrock profile.');
  }
  return buildMinecraftGeometry(document, {
    formatVersion: profile.geometryFormatVersion,
    identifier: profile.geometryIdentifier,
    ...(profile.visibleBounds ? { visibleBounds: profile.visibleBounds } : {})
  });
};

export const buildMinecraftBedrockAnimations = (document: ExportAdaptedDocument) => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.bedrock') {
    throw new Error('Project does not use the minecraft.bedrock profile.');
  }
  return buildMinecraftActorAnimation(document, {
    formatVersion: profile.animationFormatVersion,
    dialect: 'bedrock'
  });
};

export const exportMinecraftBedrock = (document: ExportAdaptedDocument): ExportBundle => {
  const validation = validateExportTarget(document, {
    profileId: 'minecraft.bedrock',
    errorMessage: 'Minecraft Bedrock export validation failed.'
  });
  const profile = validation.profile;
  const directory = profile.geometryKind === 'block' ? 'blocks' : 'entity';
  const geometryPath = `models/${directory}/${profile.modelPath}.geo.json`;
  const animationPath = `animations/${profile.animationPath}.animation.json`;
  const geometry = buildMinecraftBedrockGeometry(document);
  const hasAnimations = Object.keys(document.animations).length > 0;
  const textureFiles = Object.values(document.textures)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(createTextureCopy);

  return createExportBundle(document, validation.findings, {
    target: {
      id: 'minecraft.bedrock',
      version: profile.minecraftVersion
    },
    rootPath: 'bedrock-resource-pack-assets',
    entrypoints: [
      geometryPath,
      ...(hasAnimations ? [animationPath] : [])
    ],
    files: [
      createCompactJsonExportFile('geometry', geometryPath, geometry),
      ...(hasAnimations
        ? [
            createCompactJsonExportFile(
              'animation',
              animationPath,
              buildMinecraftBedrockAnimations(document)
            )
          ]
        : []),
      ...textureFiles
    ],
  });
};
