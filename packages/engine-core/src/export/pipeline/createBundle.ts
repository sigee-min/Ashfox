import type { ProjectDocument } from '../../model';
import type { InvariantFinding } from '../../validation/types';
import { createExportAdaptationReceipt } from '../adaptations';
import type {
  ExportBundle,
  ExportFile,
  ExportTargetId
} from '../types';
import { EXPORT_BUNDLE_SCHEMA_VERSION } from '../types';

export interface ExportBundleContent {
  target: {
    id: ExportTargetId;
    version: string;
  };
  rootPath: string;
  entrypoints: readonly string[];
  files: readonly ExportFile[];
}

export const createExportBundle = (
  document: ProjectDocument,
  findings: readonly InvariantFinding[],
  content: ExportBundleContent
): ExportBundle => ({
  schemaVersion: EXPORT_BUNDLE_SCHEMA_VERSION,
  projectId: document.id,
  revision: document.revision,
  target: content.target,
  rootPath: content.rootPath,
  entrypoints: content.entrypoints,
  files: content.files,
  findings,
  adaptations: createExportAdaptationReceipt(document)
});
