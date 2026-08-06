import type { ProjectDocument } from './model';
import {
  deriveGeneratedTextures
} from './textures/textureRecipe';
import {
  ProjectInvariantError,
  validateProjectDocument
} from './validation';
import { validateProjectDocumentContract } from './validation/projectDocumentContract';

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

export const parseProjectDocument = (
  value: unknown
): ProjectDocument => {
  if (!isRecord(value)) {
    throw new ProjectFileError('Project file must contain a JSON object.');
  }

  const report = validateProjectDocument(value);
  if (!report.valid) throw new ProjectInvariantError(report);
  if (!validateProjectDocumentContract(value, () => undefined)) {
    throw new ProjectInvariantError(report);
  }
  const document: ProjectDocument = value;
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
