import { isNonEmptyString } from './shared/value';
import type {
  FindingSink,
  IdRegistrar,
  InvariantFinding
} from './types';

export interface ValidationContext {
  readonly findings: InvariantFinding[];
  readonly add: FindingSink;
  readonly registerId: IdRegistrar;
}

export const createValidationContext = (): ValidationContext => {
  const findings: InvariantFinding[] = [];
  const idPaths = new Map<string, string>();
  const add: FindingSink = (finding) => {
    findings.push(finding);
  };
  const registerId: IdRegistrar = (id, path) => {
    if (!isNonEmptyString(id)) {
      add({
        code: 'document.required_value',
        severity: 'error',
        message: 'Addressable IDs must be non-empty strings.',
        path
      });
      return;
    }
    const existing = idPaths.get(id);
    if (existing && existing !== path) {
      add({
        code: 'identity.duplicate',
        severity: 'error',
        message: `ID "${id}" is reused at "${existing}" and "${path}".`,
        path
      });
      return;
    }
    idPaths.set(id, path);
  };

  return { findings, add, registerId };
};
