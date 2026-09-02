import {
  readExportAdapterInput,
  validateAssetProjectExportTarget,
  type AssetProject,
  type ExportAdapterInput,
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import type {
  InspectResult
} from '../types';
import {
  DETAIL_INSPECT_LIMIT
} from './inspectResult';

/** Read-only, single-target export preflight. It never emits artifact bytes. */
export const inspectExportTarget = (
  project: AssetProject,
  adapter: ExportAdapterInput
): InspectResult => {
  let current: ExportAdapterInput;
  try {
    current = readExportAdapterInput(adapter);
  } catch {
    return {
      ok: false,
      revision: project.revision,
      error: {
        code: 'invalid_request',
        path: 'adapter',
        expected: 'current export adapter input'
      }
    };
  }
  try {
    return boundedSuccess(
      project.revision,
      validateAssetProjectExportTarget(project, current),
      DETAIL_INSPECT_LIMIT
    );
  } catch {
    return {
      ok: false,
      revision: project.revision,
      error: {
        code: 'invalid_request',
        path: 'adapter',
        expected: 'export target valid for the current project'
      }
    };
  }
};
