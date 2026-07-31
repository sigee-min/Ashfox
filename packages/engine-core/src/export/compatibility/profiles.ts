import type { ProjectFormatProfile } from '../../model';
import { exportCompatibilityFor } from './queries';
import type {
  ExportPreset,
  MinecraftGameVersion
} from './types';

export const formatProfileForExport = (
  target: ExportPreset,
  gameVersion: MinecraftGameVersion | undefined,
  namespace: string,
  modelPath: string
): ProjectFormatProfile | null => {
  const compatibility = exportCompatibilityFor(target, gameVersion);
  if (!compatibility) return null;

  switch (compatibility.target) {
    case 'gltf':
    case 'glb':
      return {
        ...compatibility.profile,
        modelPath
      };
    case 'java_block':
      return {
        ...compatibility.profile,
        namespace,
        modelPath
      };
    case 'bedrock':
      return {
        ...compatibility.profile,
        namespace,
        modelPath,
        animationPath: modelPath,
        geometryIdentifier:
          `geometry.${modelPath.split('/').join('.')}`
      };
    case 'geckolib5':
      return {
        ...compatibility.profile,
        namespace,
        modelPath,
        animationPath: modelPath,
        geometryIdentifier:
          `geometry.${modelPath.split('/').join('.')}`
      };
  }
};

export const preserveFormatProfilePreferences = (
  current: ProjectFormatProfile,
  next: ProjectFormatProfile
): ProjectFormatProfile => {
  if (current.id !== next.id) return next;

  switch (next.id) {
    case 'ashfox.generic':
      return next;
    case 'minecraft.java_block': {
      if (current.id !== next.id) return next;
      return {
        ...next,
        ...(current.parent === undefined
          ? {}
          : { parent: current.parent }),
        ...(current.ambientOcclusion === undefined
          ? {}
          : { ambientOcclusion: current.ambientOcclusion }),
        ...(current.guiLight === undefined
          ? {}
          : { guiLight: current.guiLight })
      };
    }
    case 'minecraft.bedrock': {
      if (current.id !== next.id) return next;
      return {
        ...next,
        geometryKind: current.geometryKind,
        ...(current.visibleBounds === undefined
          ? {}
          : { visibleBounds: current.visibleBounds })
      };
    }
    case 'minecraft.java.geckolib5': {
      if (current.id !== next.id) return next;
      return {
        ...next,
        assetKind: current.assetKind,
        ...(current.visibleBounds === undefined
          ? {}
          : { visibleBounds: current.visibleBounds })
      };
    }
    case 'gltf.2': {
      if (current.id !== next.id) return next;
      return {
        ...next,
        ...(current.copyright === undefined
          ? {}
          : { copyright: current.copyright })
      };
    }
  }
};
