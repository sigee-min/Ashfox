import type { ProjectDocument } from '@ashfox/engine-core';

import { canonicalFingerprint } from '../canonicalFingerprint';
import type { UnsignedVisualReviewReceipt } from './schema';

export const visualReviewEvidenceFingerprint = (
  document: ProjectDocument,
  receipt: UnsignedVisualReviewReceipt
): string => canonicalFingerprint({ receipt, document });
