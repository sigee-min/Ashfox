import {
  exportCompatibilityOptions,
  type ExportCompatibilityOption,
  type MinecraftGameVersion,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  editableProjectTargetFor,
  projectGameVersionOptionsFor
} from '../../../application/projectExportTarget';

export interface ExportCompatibilitySummary {
  gameVersion: MinecraftGameVersion | null;
  animationSupport:
    ExportCompatibilityOption['animationSupport'] | null;
  supportedGameVersions: readonly {
    version: MinecraftGameVersion;
    label: string;
    isDefaultVersion: boolean;
  }[];
}

export const exportCompatibilitySummary = (
  document: ProjectDocument
): ExportCompatibilitySummary => {
  const target = editableProjectTargetFor(document);
  const options = target === null
    ? []
    : exportCompatibilityOptions(target.target);
  const selected = target === null
    ? null
    : options.find(
        (option) => option.gameVersion === target.gameVersion
      ) ?? options.find((option) => option.isDefaultVersion) ?? null;
  return {
    gameVersion: target?.gameVersion ?? null,
    animationSupport: selected?.animationSupport ?? null,
    supportedGameVersions: target === null
      ? []
      : projectGameVersionOptionsFor(target.target).map((option) => ({
          version: option.value,
          label: option.label,
          isDefaultVersion: option.isDefaultVersion
        }))
  };
};
