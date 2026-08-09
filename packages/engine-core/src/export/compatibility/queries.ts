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

export const supportsJavaBlockMultiAxisRotation = (
  gameVersion: JavaGameVersion
): boolean =>
  exportCompatibilityFor(
    'java_block',
    gameVersion
  )?.supportsJavaBlockMultiAxisRotation ?? false;
