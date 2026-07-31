import type {
  PresentSuccess,
  VisualReviewIssue
} from './types';

export interface VisualReviewReceipt {
  projectId: string;
  revision: string;
  mode: PresentSuccess['data']['mode'];
  camera: PresentSuccess['data']['camera'];
  clipId: string | null;
  observedTimeSeconds: number;
  completedCycles: number;
  frameNonce: number;
  verdict: 'accepted' | 'rejected';
  issues: readonly VisualReviewIssue[];
}

const receiptKey = (
  receipt: VisualReviewReceipt
): string =>
  JSON.stringify([
    receipt.mode,
    receipt.camera,
    receipt.clipId
  ]);

export const visualReviewReceiptFrom = (
  projectId: string,
  result: PresentSuccess
): VisualReviewReceipt | null =>
  result.data.verdict === 'pending'
    ? null
    : {
        projectId,
        revision: result.revision,
        mode: result.data.mode,
        camera: result.data.camera,
        clipId: result.data.clipId,
        observedTimeSeconds: result.data.observedTimeSeconds,
        completedCycles: result.data.completedCycles,
        frameNonce: result.data.frameNonce,
        verdict: result.data.verdict,
        issues: result.data.issues
      };

export const recordVisualReview = (
  receipts: readonly VisualReviewReceipt[],
  receipt: VisualReviewReceipt
): readonly VisualReviewReceipt[] => {
  const next = receipts.filter(
    (candidate) =>
      candidate.projectId === receipt.projectId &&
      candidate.revision === receipt.revision &&
      receiptKey(candidate) !== receiptKey(receipt)
  );
  return [...next, receipt].sort((left, right) =>
    receiptKey(left).localeCompare(receiptKey(right))
  );
};

export const visualReviewsForRevision = (
  receipts: readonly VisualReviewReceipt[],
  projectId: string,
  revision: string
): readonly VisualReviewReceipt[] =>
  receipts.filter(
    (receipt) =>
      receipt.projectId === projectId &&
      receipt.revision === revision
  );

export const rejectedVisualReviewsForRevision = (
  receipts: readonly VisualReviewReceipt[],
  projectId: string,
  revision: string
): readonly VisualReviewReceipt[] =>
  visualReviewsForRevision(receipts, projectId, revision)
    .filter((receipt) => receipt.verdict === 'rejected');
