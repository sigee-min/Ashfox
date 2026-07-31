import type { ProjectDocument } from '../../model';
import { validateForeignGeometry } from './foreignGeometryValidator';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './types';

export const validateCompiledPartEnvironment = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>
): readonly PartInvariantIssue[] => {
  const issues: PartInvariantIssue[] = [];
  validateForeignGeometry(document, parts, issues);
  return issues;
};
