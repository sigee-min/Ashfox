import type {
  ProjectCommandOperation,
  ProjectDocument
} from '@ashfox/engine-core';

export interface ProjectSettingsInput {
  name: string;
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
  return operations;
};
