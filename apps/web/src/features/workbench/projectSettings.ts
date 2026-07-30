import type {
  ProjectCommandOperation,
  ProjectDocument,
  SurfacePixelDensity
} from '@ashfox/engine-core';

export interface ProjectSettingsInput {
  name: string;
  surfacePixelDensity: SurfacePixelDensity;
}

export const createProjectSettingsOperations = (
  document: ProjectDocument,
  input: ProjectSettingsInput
): readonly ProjectCommandOperation[] => {
  const operations: ProjectCommandOperation[] = [];
  if (input.name !== document.name) {
    operations.push({
      name: 'project.rename',
      payload: { name: input.name }
    });
  }
  if (
    input.surfacePixelDensity !==
    document.settings.surfacePixelDensity
  ) {
    operations.push({
      name: 'textures.density.set',
      payload: {
        density: input.surfacePixelDensity
      }
    });
  }
  return operations;
};
