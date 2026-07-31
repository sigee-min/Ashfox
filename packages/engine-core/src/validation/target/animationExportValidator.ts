import type { ProjectDocument } from '../../model';
import { analyzeProjectAnimationCapabilities } from '../../animation/capability';
import type { FindingSink } from '../types';

export const validateAnimationExportCapabilities = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const report = analyzeProjectAnimationCapabilities(document);
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
