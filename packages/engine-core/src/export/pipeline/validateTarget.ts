import type { ExportFormatProfile } from '../adapterTypes';
import {
  canonicalProjectFromExportAdapter,
  type ExportAdaptedDocument
} from '../adapter';
import {
  validateProjectDocument
} from '../../validation';
import { validateFormatProfile } from '../../validation/target/formatValidator';
import { createValidationContext } from '../../validation/context';
import type {
  InvariantFinding
} from '../../validation/types';
import { ProjectExportError } from '../types';

export interface ExportTargetValidation {
  profileId: ExportFormatProfile['id'];
  errorMessage: string;
}

export interface ValidatedExportTarget<
  TProfileId extends ExportFormatProfile['id']
> {
  profile: Extract<ExportFormatProfile, { id: TProfileId }>;
  findings: readonly InvariantFinding[];
}

export const validateExportTarget = <
  TProfileId extends ExportFormatProfile['id']
>(
  document: ExportAdaptedDocument,
  target: ExportTargetValidation & { profileId: TProfileId }
): ValidatedExportTarget<TProfileId> => {
  const canonicalReport = validateProjectDocument(
    canonicalProjectFromExportAdapter(document)
  );
  const adapterContext = createValidationContext();
  validateFormatProfile(document, adapterContext.add);
  const findings = [
    ...canonicalReport.findings,
    ...adapterContext.findings
  ].sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
  );
  const valid = !findings.some((finding) => finding.severity === 'error');
  if (!valid || document.formatProfile.id !== target.profileId) {
    throw new ProjectExportError(target.errorMessage, findings);
  }
  return {
    profile: document.formatProfile as Extract<
      ExportFormatProfile,
      { id: TProfileId }
    >,
    findings
  };
};
