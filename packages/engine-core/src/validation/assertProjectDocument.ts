import type { ProjectDocument } from '../model';
import { validateProjectDocument } from './projectDocumentValidator';
import { ProjectInvariantError } from './types';

export const assertProjectDocument = (
  document: ProjectDocument
): void => {
  const report = validateProjectDocument(document);
  if (!report.valid) {
    throw new ProjectInvariantError(report);
  }
};
