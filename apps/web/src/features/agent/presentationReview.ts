import type {
  PresentSuccess
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
): VisualReviewReceipt => ({
  projectId,
  revision: result.revision,
  mode: result.data.mode,
  camera: result.data.camera,
  clipId: result.data.clipId,
  observedTimeSeconds: result.data.observedTimeSeconds,
  completedCycles: result.data.completedCycles,
  frameNonce: result.data.frameNonce
});

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
