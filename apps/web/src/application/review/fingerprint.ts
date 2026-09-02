import type { AssetProject } from '@ashfox/engine-core';

import { canonicalFingerprint } from '../canonicalFingerprint';
import type { UnsignedVisualReviewReceipt } from './schema';

export const visualReviewEvidenceFingerprint = (
  project: AssetProject,
  receipt: UnsignedVisualReviewReceipt
): string => canonicalFingerprint({
  receipt,
  projectId: project.id,
  revision: project.revision,
  entry: project.entry,
  build: project.build,
  document: project.document
});
