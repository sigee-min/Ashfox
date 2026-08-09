import {
  ASHFOX_GENERIC_FORMAT_VERSION,
} from '../../../model';
import {
  canonicalProjectFromExportAdapter,
  type ExportAdaptedDocument
} from '../../adapter';
import { createJsonExportFile } from '../../json';
import { createExportBundle } from '../../pipeline/createBundle';
import { validateExportTarget } from '../../pipeline/validateTarget';
import type { ExportBundle } from '../../types';

export const exportGenericProject = (
  document: ExportAdaptedDocument
): ExportBundle => {
  const validation = validateExportTarget(document, {
    profileId: 'ashfox.generic',
    errorMessage: 'Generic ashfox export validation failed.'
  });
  const path = 'project.json';
  const canonical = canonicalProjectFromExportAdapter(document);
  return createExportBundle(document, validation.findings, {
    target: {
      id: 'ashfox.generic',
      version: ASHFOX_GENERIC_FORMAT_VERSION
    },
    rootPath: 'ashfox-project',
    entrypoints: [path],
    files: [createJsonExportFile('model', path, canonical)]
  });
};
