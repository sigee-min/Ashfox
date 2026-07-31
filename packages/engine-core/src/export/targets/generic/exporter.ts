import type { ProjectDocument } from '../../../model';
import { createJsonExportFile } from '../../json';
import { createExportBundle } from '../../pipeline/createBundle';
import { validateExportTarget } from '../../pipeline/validateTarget';
import type { ExportBundle } from '../../types';

export const exportGenericProject = (
  document: ProjectDocument
): ExportBundle => {
  const validation = validateExportTarget(document, {
    profileId: 'ashfox.generic',
    errorMessage: 'Generic ashfox export validation failed.',
    options: { includeFormatProfile: false }
  });
  const path = 'project.json';
  return createExportBundle(document, validation.findings, {
    target: {
      id: 'ashfox.generic',
      version: '1'
    },
    rootPath: 'ashfox-project',
    entrypoints: [path],
    files: [createJsonExportFile('model', path, document)]
  });
};
