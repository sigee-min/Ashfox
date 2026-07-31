import type {
  ProjectDocument,
  ProductionReadinessReport
} from '@ashfox/engine-core';

import {
  visualReviewsForRevision,
  type VisualReviewReceipt
} from './presentationReview';

export type VisualReviewCamera =
  | 'perspective'
  | 'front'
  | 'side'
  | 'top';

export interface VisualReviewPlanItem {
  mode: 'frame' | 'cycle';
  camera: VisualReviewCamera;
  clipId: string | null;
}

const STATIC_CAMERAS: readonly VisualReviewCamera[] = [
  'perspective',
  'front',
  'side',
  'top'
];

export const visualReviewKey = (
  review: VisualReviewPlanItem
): string =>
  review.clipId === null
    ? `${review.mode}:${review.camera}`
    : `${review.mode}:${review.camera}:${review.clipId}`;

export const requiredVisualReviews = (
  document: ProjectDocument
): readonly VisualReviewPlanItem[] => [
  ...STATIC_CAMERAS.map((camera): VisualReviewPlanItem => ({
    mode: 'frame',
    camera,
    clipId: null
  })),
  ...Object.keys(document.animations)
    .sort()
    .map((clipId): VisualReviewPlanItem => ({
      mode: 'cycle',
      camera: 'perspective',
      clipId
    }))
];

const completedVisualReviewKeys = (
  document: ProjectDocument,
  receipts: readonly VisualReviewReceipt[]
): ReadonlySet<string> =>
  new Set(
    visualReviewsForRevision(
      receipts,
      document.id,
      document.revision
    ).flatMap((receipt) => {
      if (
        receipt.mode === 'cycle' &&
        receipt.completedCycles < 1
      ) {
        return [];
      }
      return [visualReviewKey(receipt)];
    })
  );

export const remainingVisualReviews = (
  document: ProjectDocument,
  readiness: ProductionReadinessReport,
  receipts: readonly VisualReviewReceipt[]
): readonly VisualReviewPlanItem[] => {
  if (readiness.counts.visibleGeometry === 0) return [];
  const completed = completedVisualReviewKeys(document, receipts);
  return requiredVisualReviews(document).filter(
    (review) => !completed.has(visualReviewKey(review))
  );
};

export const nextVisualReview = (
  document: ProjectDocument,
  readiness: ProductionReadinessReport,
  receipts: readonly VisualReviewReceipt[]
): VisualReviewPlanItem | null =>
  remainingVisualReviews(document, readiness, receipts)[0] ?? null;
