import type { ExportAdaptedDocument } from '../../export/adapter';
import { analyzeProjectAnimationCapabilities } from '../../animation/capability';
import type { FindingSink } from '../types';

export const validateAnimationExportCapabilities = (
  document: ExportAdaptedDocument,
  add: FindingSink
): void => {
  const report = analyzeProjectAnimationCapabilities(
    document,
    document.formatProfile.id
  );
  for (const clip of report.clips) {
    for (const issue of clip.exportIssues) {
      add({
        code:
          issue.code === 'timestamp_collision'
            ? 'animation.key_order'
            : 'format.unsupported_data',
        severity: 'error',
        message: issue.message,
        path: issue.path,
        clipIds: [issue.clipId]
      });
    }
  }
};
