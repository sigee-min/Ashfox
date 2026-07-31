import type {
  ProjectCommandOperation,
  ProjectDocument,
  SurfacePixelDensity
} from '@ashfox/engine-core';
import {
  type EditableProjectTarget,
  editableProjectTargetFor
} from '../../application/projectExportTarget';

export interface ProjectSettingsInput {
  name: string;
  surfacePixelDensity: SurfacePixelDensity;
  exportTarget: EditableProjectTarget | null;
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
  const currentTarget = editableProjectTargetFor(document);
  const targetChanged =
    input.exportTarget !== null &&
    (
      currentTarget === null ||
      currentTarget.target !== input.exportTarget.target
    );
  if (
    input.exportTarget !== null &&
    targetChanged
  ) {
    operations.push({
      name: 'project.target.set',
      payload: {
        target: input.exportTarget.target
      }
    });
  }
  if (
    input.exportTarget !== null &&
    (
      targetChanged ||
      currentTarget === null ||
      currentTarget.namespace !== input.exportTarget.namespace ||
      currentTarget.modelPath !== input.exportTarget.modelPath
    )
  ) {
    operations.push({
      name: 'project.resource.set',
      payload: {
        namespace: input.exportTarget.namespace,
        modelPath: input.exportTarget.modelPath
      }
    });
  }
  return operations;
};
