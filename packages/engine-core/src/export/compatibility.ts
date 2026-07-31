import type {
  ProjectFormatProfile
} from '../model';
import { resourceToken } from '../resourceToken';

export const EXPORT_COMPATIBILITY_REGISTRY = [
  {
    target: 'geckolib5',
    label: 'GeckoLib 5',
    gameVersion: '1.21.5',
    gameVersionLabel: 'Java 1.21.5',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '1.21.5',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      assetKind: 'entity'
    }
  },
  {
    target: 'geckolib5',
    label: 'GeckoLib 5',
    gameVersion: '1.21.11',
    gameVersionLabel: 'Java 1.21.11',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '1.21.11',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      assetKind: 'entity'
    }
  },
  {
    target: 'geckolib5',
    label: 'GeckoLib 5',
    gameVersion: '26.1',
    gameVersionLabel: 'Java 26.1',
    isDefaultVersion: true,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '26.1',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      assetKind: 'entity'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '1.21.5',
    gameVersionLabel: 'Java 1.21.5',
    isDefaultVersion: false,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: false,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '1.21.5',
      resourcePackFormat: 55,
      modelKind: 'block'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '1.21.11',
    gameVersionLabel: 'Java 1.21.11',
    isDefaultVersion: false,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: true,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '1.21.11',
      resourcePackFormat: 75,
      modelKind: 'block'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '26.1',
    gameVersionLabel: 'Java 26.1',
    isDefaultVersion: false,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: true,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '26.1',
      resourcePackFormat: 84,
      modelKind: 'block'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '26.2',
    gameVersionLabel: 'Java 26.2',
    isDefaultVersion: true,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: true,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '26.2',
      resourcePackFormat: 88,
      modelKind: 'block'
    }
  },
  {
    target: 'bedrock',
    label: 'Bedrock geometry',
    gameVersion: '1.21.130',
    gameVersionLabel: 'Bedrock 1.21.130',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.bedrock',
      minecraftVersion: '1.21.130',
      geometryFormatVersion: '1.21.0',
      animationFormatVersion: '1.8.0',
      geometryKind: 'entity'
    }
  },
  {
    target: 'bedrock',
    label: 'Bedrock geometry',
    gameVersion: '1.26.0',
    gameVersionLabel: 'Bedrock 1.26.0',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.bedrock',
      minecraftVersion: '1.26.0',
      geometryFormatVersion: '1.21.0',
      animationFormatVersion: '1.8.0',
      geometryKind: 'entity'
    }
  },
  {
    target: 'bedrock',
    label: 'Bedrock geometry',
    gameVersion: '1.26.30',
    gameVersionLabel: 'Bedrock 1.26.30',
    isDefaultVersion: true,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.bedrock',
      minecraftVersion: '1.26.30',
      geometryFormatVersion: '1.21.0',
      animationFormatVersion: '1.8.0',
      geometryKind: 'entity'
    }
  },
  {
    target: 'glb',
    label: 'GLB',
    gameVersion: null,
    gameVersionLabel: null,
    isDefaultVersion: true,
    animationSupport: 'scene',
    profile: {
      id: 'gltf.2',
      version: '2.0',
      container: 'glb',
      imageStorage: 'embedded'
    }
  },
  {
    target: 'gltf',
    label: 'glTF',
    gameVersion: null,
    gameVersionLabel: null,
    isDefaultVersion: true,
    animationSupport: 'scene',
    profile: {
      id: 'gltf.2',
      version: '2.0',
      container: 'gltf',
      imageStorage: 'external'
    }
  }
] as const;

type ExportCompatibilityEntry =
  (typeof EXPORT_COMPATIBILITY_REGISTRY)[number];

export type ExportPreset = ExportCompatibilityEntry['target'];

export type MinecraftGameVersion = Exclude<
  ExportCompatibilityEntry['gameVersion'],
  null
>;

export type JavaGameVersion = Extract<
  ExportCompatibilityEntry,
  { target: 'java_block' }
>['gameVersion'];

export interface ExportCompatibilityOption {
  target: ExportPreset;
  label: string;
  gameVersion: MinecraftGameVersion | null;
  gameVersionLabel: string | null;
  isDefaultVersion: boolean;
  animationSupport: 'none' | 'actor' | 'scene';
}

export const EXPORT_PRESETS = Object.freeze(
  [...new Set(
    EXPORT_COMPATIBILITY_REGISTRY.map(({ target }) => target)
  )]
) as readonly ExportPreset[];

export const MINECRAFT_GAME_VERSIONS = Object.freeze(
  [...new Set(
    EXPORT_COMPATIBILITY_REGISTRY.flatMap(({ gameVersion }) =>
      gameVersion === null ? [] : [gameVersion]
    )
  )]
) as readonly MinecraftGameVersion[];

const MINECRAFT_NAMESPACE = /^[a-z0-9_.-]+$/;
const MINECRAFT_MODEL_PATH = /^[a-z0-9_./-]+$/;
const GLTF_MODEL_PATH = /^[A-Za-z0-9_./-]+$/;

const isMinecraftExportPreset = (
  target: ExportPreset
): boolean =>
  target === 'bedrock' ||
  target === 'geckolib5' ||
  target === 'java_block';

export const isExportNamespaceValid = (
  target: ExportPreset,
  value: string
): boolean =>
  !isMinecraftExportPreset(target) ||
  MINECRAFT_NAMESPACE.test(value);

export const isExportModelPathValid = (
  target: ExportPreset,
  value: string
): boolean => {
  const pattern =
    target === 'gltf' || target === 'glb'
      ? GLTF_MODEL_PATH
      : MINECRAFT_MODEL_PATH;
  return (
    pattern.test(value) &&
    !value.startsWith('/') &&
    !value.endsWith('/') &&
    !value.includes('..') &&
    (
      target === 'gltf' || target === 'glb'
        ? !/\.(?:gltf|glb|bin)$/i.test(value)
        : !value.endsWith('.json')
    )
  );
};

export const exportCompatibilityOptions = (
  target?: ExportPreset
): readonly ExportCompatibilityOption[] =>
  EXPORT_COMPATIBILITY_REGISTRY
    .filter((entry) => target === undefined || entry.target === target)
    .map((entry) => ({
      target: entry.target,
      label: entry.label,
      gameVersion: entry.gameVersion,
      gameVersionLabel: entry.gameVersionLabel,
      isDefaultVersion: entry.isDefaultVersion,
      animationSupport: entry.animationSupport
    }));

export const exportCompatibilityFor = <TTarget extends ExportPreset>(
  target: TTarget,
  gameVersion?: MinecraftGameVersion
): Extract<ExportCompatibilityEntry, { target: TTarget }> | null =>
  (EXPORT_COMPATIBILITY_REGISTRY.find((entry) =>
    entry.target === target &&
    (
      gameVersion === undefined
        ? entry.isDefaultVersion
        : entry.gameVersion === gameVersion
    )
  ) as Extract<ExportCompatibilityEntry, { target: TTarget }> | undefined) ??
  null;

const compatibilityForFormatProfile = (
  profile: ProjectFormatProfile
): ExportCompatibilityEntry | null =>
  EXPORT_COMPATIBILITY_REGISTRY.find((entry) => {
    if (entry.profile.id !== profile.id) return false;
    switch (entry.target) {
      case 'gltf':
      case 'glb':
        return (
          profile.id === 'gltf.2' &&
          profile.version === entry.profile.version &&
          profile.container === entry.profile.container
        );
      case 'java_block':
        return (
          profile.id === 'minecraft.java_block' &&
          profile.minecraftVersion === entry.profile.minecraftVersion &&
          profile.resourcePackFormat === entry.profile.resourcePackFormat
        );
      case 'bedrock':
        return (
          profile.id === 'minecraft.bedrock' &&
          profile.minecraftVersion === entry.profile.minecraftVersion &&
          profile.geometryFormatVersion ===
            entry.profile.geometryFormatVersion &&
          profile.animationFormatVersion ===
            entry.profile.animationFormatVersion
        );
      case 'geckolib5':
        return (
          profile.id === 'minecraft.java.geckolib5' &&
          profile.version === entry.profile.version &&
          profile.minecraftVersion === entry.profile.minecraftVersion &&
          profile.geometryFormatVersion ===
            entry.profile.geometryFormatVersion &&
          profile.animationFormatVersion ===
            entry.profile.animationFormatVersion
        );
    }
  }) ?? null;

export const exportPresetForFormatProfile = (
  profile: ProjectFormatProfile
): ExportPreset | null =>
  compatibilityForFormatProfile(profile)?.target ?? null;

export const gameVersionForFormatProfile = (
  profile: ProjectFormatProfile
): MinecraftGameVersion | null =>
  compatibilityForFormatProfile(profile)?.gameVersion ?? null;

export const animationSupportForFormatProfile = (
  profile: ProjectFormatProfile
): ExportCompatibilityOption['animationSupport'] | null =>
  compatibilityForFormatProfile(profile)?.animationSupport ?? null;

export const supportsJavaBlockMultiAxisRotation = (
  gameVersion: JavaGameVersion
): boolean =>
  exportCompatibilityFor(
    'java_block',
    gameVersion
  )?.supportsJavaBlockMultiAxisRotation ?? false;

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

export const normalizeExportModelPath = (
  target: ExportPreset,
  value: string
): string =>
  target === 'bedrock' ||
  target === 'geckolib5' ||
  target === 'java_block'
    ? value
      .split('/')
      .map((segment) => resourceToken(segment, 'asset'))
      .join('/')
    : value;

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
