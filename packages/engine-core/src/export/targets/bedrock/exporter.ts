import type { ProjectDocument, TextureAsset } from '../../../model';
import { validateProjectDocument } from '../../../validation';
import { createExportAdaptationReceipt } from '../../adaptations';
import { createJsonExportFile } from '../../json';
import { buildMinecraftActorAnimation } from '../../shared/minecraftAnimation';
import { buildMinecraftGeometry } from '../../shared/minecraftGeometry';
import {
  ProjectExportError,
  type BlobCopyExportFile,
  type ExportBundle
} from '../../types';

const createTextureCopy = (texture: TextureAsset): BlobCopyExportFile => {
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

export const buildMinecraftBedrockGeometry = (document: ProjectDocument) => {
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

export const buildMinecraftBedrockAnimations = (document: ProjectDocument) => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.bedrock') {
    throw new Error('Project does not use the minecraft.bedrock profile.');
  }
  return buildMinecraftActorAnimation(document, {
    formatVersion: profile.animationFormatVersion,
    dialect: 'bedrock'
  });
};

export const exportMinecraftBedrock = (document: ProjectDocument): ExportBundle => {
  const report = validateProjectDocument(document);
  if (!report.valid || document.formatProfile.id !== 'minecraft.bedrock') {
    throw new ProjectExportError('Minecraft Bedrock export validation failed.', report.findings);
  }
  const profile = document.formatProfile;
  const directory = profile.geometryKind === 'block' ? 'blocks' : 'entity';
  const geometryPath = `models/${directory}/${profile.modelPath}.geo.json`;
  const animationPath = `animations/${profile.animationPath}.animation.json`;
  const geometry = buildMinecraftBedrockGeometry(document);
  const hasAnimations = Object.keys(document.animations).length > 0;
  const textureFiles = Object.values(document.textures)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(createTextureCopy);

  return {
    schemaVersion: 1,
    projectId: document.id,
    revision: document.revision,
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
      createJsonExportFile('geometry', geometryPath, geometry),
      ...(hasAnimations
        ? [
            createJsonExportFile(
              'animation',
              animationPath,
              buildMinecraftBedrockAnimations(document)
            )
          ]
        : []),
      ...textureFiles
    ],
    findings: report.findings,
    adaptations: createExportAdaptationReceipt(document)
  };
};
