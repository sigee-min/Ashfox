import type { ProjectDocument } from '../model';
import { validateProjectDocument } from './projectDocumentValidator';
import {
  ProjectInvariantError,
  type ValidateProjectOptions
} from './types';

export const assertProjectDocument = (
  document: ProjectDocument,
  options?: ValidateProjectOptions
): void => {
  const report = validateProjectDocument(document, options);
  if (!report.valid) {
    throw new ProjectInvariantError(report);
  }
};
