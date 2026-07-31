import type {
  ExportPreset,
  ProjectDocument
} from '@ashfox/engine-core';

export type VisibleExportPreset = ExportPreset;

export type ProjectArtifactTarget =
  | VisibleExportPreset
  | 'ashfox.generic'
  | 'minecraft.java_block';

export interface ProjectExportTarget {
  target: ProjectArtifactTarget;
  namespace: string;
  modelPath: string;
}

export interface EditableProjectTarget {
  target: VisibleExportPreset;
  namespace: string;
  modelPath: string;
}

export interface ProjectExportTargetOption {
  id: VisibleExportPreset;
  label: string;
  detail: string;
}

export const PROJECT_EXPORT_TARGETS: readonly ProjectExportTargetOption[] = [
  {
    id: 'geckolib5',
    label: 'GeckoLib 5',
    detail: 'Minecraft Java animated asset'
  },
  {
    id: 'bedrock',
    label: 'Bedrock',
    detail: 'Geometry and actor animation'
  },
  {
    id: 'glb',
    label: 'GLB',
    detail: 'Single embedded binary'
  },
  {
    id: 'gltf',
    label: 'glTF',
    detail: 'JSON with external resources'
  }
];

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
    case 'gltf.2':
      return document.formatProfile.container;
    case 'ashfox.generic':
    case 'minecraft.java_block':
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
        : profile.modelPath
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
        modelPath: target.modelPath
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
      : 'Java block model'
  );

export const isMinecraftExportTarget = (
  target: VisibleExportPreset | null
): boolean =>
  target === 'bedrock' || target === 'geckolib5';
