import {
  exportCompatibilityOptions,
  exportTargetDescriptorForPreset,
  type ExportAdapterInput,
  type ExportPreset,
  type ProjectDocument
} from '@ashfox/engine-core';

export type VisibleExportPreset = ExportPreset;

export interface ExportAdapterDraft {
  target: VisibleExportPreset;
  namespace: string;
  modelPath: string;
}

export interface ProjectExportTargetOption {
  id: VisibleExportPreset;
  label: string;
  detail: string;
}

const TARGET_DETAILS: Readonly<Record<VisibleExportPreset, string>> = {
  gltf: 'JSON with external resources',
  glb: 'Single embedded binary',
  java_block: 'Static Java block model',
  bedrock: 'Geometry and actor animation',
  geckolib5: 'Java animated asset'
};

export const PROJECT_EXPORT_TARGETS = Object.freeze(
  exportCompatibilityOptions().map((option) => ({
    id: option.target,
    label: option.label,
    detail: TARGET_DETAILS[option.target]
  }))
) as readonly ProjectExportTargetOption[];

export const projectTargetVersionFor = (
  target: VisibleExportPreset | null
): string | null => target === null
  ? null
  : exportTargetDescriptorForPreset(target).target.version;

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
  namespace: 'ashfox',
  modelPath: projectResourceToken(document.name)
});

export const exportAdapterInputFor = (
  draft: ExportAdapterDraft
): ExportAdapterInput => {
  switch (draft.target) {
    case 'bedrock':
    case 'geckolib5':
    case 'java_block':
      return {
        target: draft.target,
        namespace: draft.namespace,
        modelPath: draft.modelPath
      };
    case 'glb':
    case 'gltf':
      return { target: draft.target, modelPath: draft.modelPath };
  }
};

export const projectExportTargetLabel = (
  target: VisibleExportPreset
): string =>
  PROJECT_EXPORT_TARGETS.find((option) => option.id === target)
    ?.label ?? target;

export const isMinecraftExportTarget = (
  target: VisibleExportPreset | null
): boolean => target !== null &&
  exportTargetDescriptorForPreset(target).namespaceRequired;
