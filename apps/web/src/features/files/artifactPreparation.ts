import {
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createTextureSyncOperation,
  projectNeedsTextureSynchronization
} from '../textures/textureSyncCommand';
import {
  projectUsesExportTarget,
  type ProjectExportTarget
} from '../workbench/presentation/projectExportTarget';

export type ArtifactPreparationRequest =
  | { kind: 'save' }
  | {
      kind: 'export';
      target: ProjectExportTarget;
    };

export const createArtifactPreparationOperations = (
  document: ProjectDocument,
  request: ArtifactPreparationRequest
): readonly ProjectCommandOperation[] => {
  const operations: ProjectCommandOperation[] = [];
  if (
    request.kind === 'export' &&
    !projectUsesExportTarget(document, request.target)
  ) {
    operations.push({
      name: 'project.target.set',
      payload: request.target
    });
  }
  if (projectNeedsTextureSynchronization(document)) {
    const operation = createTextureSyncOperation(document);
    if (!operation) {
      throw new Error(
        'Generated texture synchronization is unavailable for this project.'
      );
    }
    operations.push(operation);
  }
  return operations;
};
