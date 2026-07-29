import type {
  ExportPreset,
  ProjectDocument
} from '@ashfox/engine-core';

export type VisibleExportPreset = Exclude<ExportPreset, 'java'>;

export interface ProjectExportTarget {
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

const resourceToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '') || 'asset';

const presetFor = (
  document: ProjectDocument
): VisibleExportPreset => {
  switch (document.formatProfile.id) {
    case 'minecraft.bedrock':
      return 'bedrock';
    case 'minecraft.java.geckolib5':
      return 'geckolib5';
    case 'gltf.2':
      return document.formatProfile.container;
    case 'ashfox.generic':
    case 'minecraft.java_block':
      return 'glb';
  }
};

export const projectExportTargetFor = (
  document: ProjectDocument
): ProjectExportTarget => {
  const profile = document.formatProfile;
  return {
    target: presetFor(document),
    namespace:
      profile.id === 'minecraft.bedrock' ||
      profile.id === 'minecraft.java.geckolib5' ||
      profile.id === 'minecraft.java_block'
        ? profile.namespace
        : 'ashfox',
    modelPath:
      profile.id === 'ashfox.generic'
        ? resourceToken(document.name)
        : profile.modelPath
  };
};

export const projectUsesExportTarget = (
  document: ProjectDocument,
  target: ProjectExportTarget
): boolean => {
  const current = projectExportTargetFor(document);
  return (
    current.target === target.target &&
    current.modelPath === target.modelPath &&
    (
      target.target === 'gltf' ||
      target.target === 'glb' ||
      current.namespace === target.namespace
    )
  );
};
