import type {
  ProjectCommandOperation,
  ProjectDocument,
  ProjectTextureResolution
} from '@ashfox/engine-core';

export interface ProjectSettingsInput {
  name: string;
  textureResolution?: ProjectTextureResolution;
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
    input.textureResolution !== undefined &&
    (
      input.textureResolution !==
        document.settings.textureResolution.width ||
      input.textureResolution !==
        document.settings.textureResolution.height
    )
  ) {
    operations.push({
      name: 'project.textureResolution.set',
      payload: { size: input.textureResolution }
    });
  }
  return operations;
};
