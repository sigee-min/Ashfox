import {
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  projectUsesExportTarget,
  type ProjectExportTarget
} from '../../application/projectExportTarget';

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
  return operations;
};
