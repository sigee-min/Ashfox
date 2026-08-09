import {
  exportCompatibilityOptions,
  type ExportAdapterInput,
  type ExportPreset,
  type MinecraftGameVersion,
  type ProjectDocument
} from '@ashfox/engine-core';

export type VisibleExportPreset = ExportPreset;

export interface ExportAdapterDraft {
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

export const defaultExportAdapterFor = (
  document: ProjectDocument
): ExportAdapterDraft => ({
  target: 'glb',
  gameVersion: null,
  namespace: 'ashfox',
  modelPath: projectResourceToken(document.name)
});

export const exportAdapterInputFor = (
  draft: ExportAdapterDraft
): ExportAdapterInput => ({
  target: draft.target,
  ...(draft.gameVersion === null
    ? {}
    : { gameVersion: draft.gameVersion }),
  ...(isMinecraftExportTarget(draft.target)
    ? { namespace: draft.namespace.trim() }
    : {}),
  modelPath: draft.modelPath.trim()
});

export const projectExportTargetLabel = (
  target: VisibleExportPreset
): string =>
  PROJECT_EXPORT_TARGETS.find((option) => option.id === target)
    ?.label ?? target;

export const isMinecraftExportTarget = (
  target: VisibleExportPreset | null
): boolean =>
  projectGameVersionOptionsFor(target).length > 0;
