import type { ProjectDocument } from './model';
import {
  ProjectInvariantError,
  validateProjectDocument
} from './validation';

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validatedShape = <T>(value: unknown): T => value as T;

export const parseProjectDocument = (
  value: unknown
): ProjectDocument => {
  if (!isRecord(value)) {
    throw new ProjectFileError('Project file must contain a JSON object.');
  }

  let report;
  const document = validatedShape<ProjectDocument>(value);
  try {
    report = validateProjectDocument(document);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ProjectFileError(`Project structure is incomplete: ${reason}`);
  }
  if (!report.valid) throw new ProjectInvariantError(report);
  return document;
};
