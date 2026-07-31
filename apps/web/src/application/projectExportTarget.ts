import type {
  ExportPreset,
  MinecraftGameVersion,
  ProjectDocument
} from '@ashfox/engine-core';
import {
  exportCompatibilityOptions,
  gameVersionForFormatProfile
} from '@ashfox/engine-core';

export type VisibleExportPreset = ExportPreset;

export type ProjectArtifactTarget =
  | VisibleExportPreset
  | 'ashfox.generic';

export interface ProjectExportTarget {
  target: ProjectArtifactTarget;
  namespace: string;
  modelPath: string;
  gameVersion: MinecraftGameVersion | null;
}

export interface EditableProjectTarget {
  target: VisibleExportPreset;
  namespace: string;
  modelPath: string;
  gameVersion: MinecraftGameVersion | null;
}

export interface ProjectExportTargetOption {
  id: VisibleExportPreset;
  label: string;
  detail: string;
}

export interface ProjectGameVersionOption {
  value: MinecraftGameVersion;
  label: string;
  isDefaultVersion: boolean;
}

const TARGET_DETAILS: Readonly<Record<VisibleExportPreset, string>> = {
  gltf: 'JSON with external resources',
  glb: 'Single embedded binary',
  java_block: 'Static Java block model',
  bedrock: 'Geometry and actor animation',
  geckolib5: 'Java animated asset'
};

const targetOptions = new Map<
  VisibleExportPreset,
  ProjectExportTargetOption
>();
for (const option of exportCompatibilityOptions()) {
  if (targetOptions.has(option.target)) continue;
  targetOptions.set(option.target, {
    id: option.target,
    label: option.label,
    detail: TARGET_DETAILS[option.target]
  });
}

export const PROJECT_EXPORT_TARGETS = Object.freeze(
  [...targetOptions.values()]
) as readonly ProjectExportTargetOption[];

export const projectGameVersionOptionsFor = (
  target: VisibleExportPreset | null
): readonly ProjectGameVersionOption[] => {
  if (target === null) return [];
  const options: ProjectGameVersionOption[] = [];
  for (const option of exportCompatibilityOptions(target)) {
    if (option.gameVersion === null) continue;
    options.push({
      value: option.gameVersion,
      label: option.gameVersionLabel ?? option.gameVersion,
      isDefaultVersion: option.isDefaultVersion
    });
  }
  return options;
};

export const defaultProjectGameVersionFor = (
  target: VisibleExportPreset | null
): MinecraftGameVersion | null => {
  const options = projectGameVersionOptionsFor(target);
  return (
    options.find((option) => option.isDefaultVersion) ?? options[0]
  )?.value ?? null;
};

export const projectResourceToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '') || 'asset';

const targetFor = (
  document: ProjectDocument
): ProjectArtifactTarget => {
  switch (document.formatProfile.id) {
    case 'minecraft.bedrock':
      return 'bedrock';
    case 'minecraft.java.geckolib5':
      return 'geckolib5';
    case 'minecraft.java_block':
      return 'java_block';
    case 'gltf.2':
      return document.formatProfile.container;
    case 'ashfox.generic':
      return document.formatProfile.id;
  }
};

export const projectExportTargetFor = (
  document: ProjectDocument
): ProjectExportTarget => {
  const profile = document.formatProfile;
  return {
    target: targetFor(document),
    namespace:
      profile.id === 'minecraft.bedrock' ||
      profile.id === 'minecraft.java.geckolib5' ||
      profile.id === 'minecraft.java_block'
        ? profile.namespace
        : 'ashfox',
    modelPath:
      profile.id === 'ashfox.generic'
        ? projectResourceToken(document.name)
        : profile.modelPath,
    gameVersion: gameVersionForFormatProfile(profile)
  };
};

export const editableProjectTargetFor = (
  document: ProjectDocument
): EditableProjectTarget | null => {
  const target = projectExportTargetFor(document);
  return PROJECT_EXPORT_TARGETS.some(
    (option) => option.id === target.target
  )
    ? {
        target: target.target as VisibleExportPreset,
        namespace: target.namespace,
        modelPath: target.modelPath,
        gameVersion: target.gameVersion
      }
    : null;
};

export const projectExportTargetLabel = (
  target: ProjectArtifactTarget
): string =>
  PROJECT_EXPORT_TARGETS.find((option) => option.id === target)
    ?.label ??
  (
    target === 'ashfox.generic'
      ? 'ashfox JSON'
      : target
  );

export const isMinecraftExportTarget = (
  target: VisibleExportPreset | null
): boolean =>
  projectGameVersionOptionsFor(target).length > 0;
