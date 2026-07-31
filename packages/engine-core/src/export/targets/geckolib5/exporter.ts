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
  const binding = texture.minecraft;
  return {
    kind: 'blob-copy',
    role: 'texture',
    path: `assets/${binding.resource.namespace}/textures/${binding.resource.path}.${binding.extension}`,
    contentType: texture.source.contentType,
    source: texture.source
  };
};

export const buildGeckoLib5Geometry = (document: ProjectDocument) => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.java.geckolib5') {
    throw new Error('Project does not use the minecraft.java.geckolib5 profile.');
  }
  return buildMinecraftGeometry(document, {
    formatVersion: profile.geometryFormatVersion,
    identifier: profile.geometryIdentifier,
    ...(profile.visibleBounds ? { visibleBounds: profile.visibleBounds } : {})
  });
};

export const buildGeckoLib5Animations = (document: ProjectDocument) => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.java.geckolib5') {
    throw new Error('Project does not use the minecraft.java.geckolib5 profile.');
  }
  return buildMinecraftActorAnimation(document, {
    formatVersion: profile.animationFormatVersion,
    dialect: 'geckolib5'
  });
};

export const exportGeckoLib5 = (document: ProjectDocument): ExportBundle => {
  const report = validateProjectDocument(document);
  if (!report.valid || document.formatProfile.id !== 'minecraft.java.geckolib5') {
    throw new ProjectExportError('GeckoLib 5 export validation failed.', report.findings);
  }
  const profile = document.formatProfile;
  const modelPath =
    `assets/${profile.namespace}/geckolib/models/${profile.assetKind}/${profile.modelPath}.geo.json`;
  const animationPath =
    `assets/${profile.namespace}/geckolib/animations/${profile.assetKind}/${profile.animationPath}.animation.json`;
  const textureFiles = Object.values(document.textures)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(createTextureCopy);

  return {
    schemaVersion: 1,
    projectId: document.id,
    revision: document.revision,
    target: {
      id: 'minecraft.java.geckolib5',
      version: profile.minecraftVersion
    },
    rootPath: 'src/main/resources',
    entrypoints: [modelPath, animationPath],
    files: [
      createJsonExportFile('geometry', modelPath, buildGeckoLib5Geometry(document)),
      createJsonExportFile('animation', animationPath, buildGeckoLib5Animations(document)),
      ...textureFiles
    ],
    findings: report.findings,
    adaptations: createExportAdaptationReceipt(document)
  };
};
