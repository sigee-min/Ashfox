import type { ProjectDocument } from './model';
import {
  deriveGeneratedTextures
} from './textures/textureRecipe';
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

  const document = validatedShape<ProjectDocument>(value);
  let report;
  try {
    report = validateProjectDocument(document);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ProjectFileError(`Project structure is incomplete: ${reason}`);
  }
  if (!report.valid) throw new ProjectInvariantError(report);
  const derived = deriveGeneratedTextures(document);
  if (!derived.ok) {
    throw new ProjectFileError(
      `Project texture derivation failed: ${derived.message}`
    );
  }
  const derivedReport = validateProjectDocument(
    derived.document
  );
  if (!derivedReport.valid) {
    throw new ProjectInvariantError(derivedReport);
  }
  return derived.document;
};
