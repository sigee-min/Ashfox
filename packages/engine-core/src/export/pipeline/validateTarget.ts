import type {
  ProjectDocument,
  ProjectFormatProfile
} from '../../model';
import {
  validateProjectDocument
} from '../../validation';
import type {
  InvariantFinding,
  ValidateProjectOptions
} from '../../validation/types';
import { ProjectExportError } from '../types';

export interface ExportTargetValidation {
  profileId: ProjectFormatProfile['id'];
  errorMessage: string;
  options?: ValidateProjectOptions;
}

export interface ValidatedExportTarget<
  TProfileId extends ProjectFormatProfile['id']
> {
  profile: Extract<ProjectFormatProfile, { id: TProfileId }>;
  findings: readonly InvariantFinding[];
}

export const validateExportTarget = <
  TProfileId extends ProjectFormatProfile['id']
>(
  document: ProjectDocument,
  target: ExportTargetValidation & { profileId: TProfileId }
): ValidatedExportTarget<TProfileId> => {
  const report = validateProjectDocument(document, target.options);
  if (!report.valid || document.formatProfile.id !== target.profileId) {
    throw new ProjectExportError(target.errorMessage, report.findings);
  }
  return {
    profile: document.formatProfile as Extract<
      ProjectFormatProfile,
      { id: TProfileId }
    >,
    findings: report.findings
  };
};
