import { VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION as CURRENT_VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION } from
  '@ashfox/internal-contracts';

import type {
  VisualReviewIssue,
  VisualReviewObservation
} from './observation';

export const VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION =
  CURRENT_VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION;

export interface VisualReviewDecision {
  readonly verdict: 'accepted' | 'rejected';
  readonly issues: readonly VisualReviewIssue[];
  readonly acknowledgedCheckIds: readonly string[];
  readonly failedCheckIds: readonly string[];
}

export interface VisualReviewReceipt {
  readonly schemaVersion: typeof VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly revision: string;
  readonly observation: VisualReviewObservation;
  readonly decision: VisualReviewDecision;
  readonly recordedAt: string;
  readonly rendererIdentifier: string;
  readonly actorId: string;
  readonly evidenceFingerprint: string;
}

export interface VisualReviewReceiptMetadata {
  readonly actorId: string;
  readonly recordedAt: string;
}

export type UnsignedVisualReviewReceipt = Omit<
  VisualReviewReceipt,
  'evidenceFingerprint'
>;
