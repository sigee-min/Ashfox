import type { ProjectFormatProfile } from '../../model';
import {
  EXPORT_COMPATIBILITY_REGISTRY,
  type ExportCompatibilityEntry
} from './registry';
import type {
  ExportCompatibilityOption,
  ExportPreset,
  JavaGameVersion,
  MinecraftGameVersion
} from './types';

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
