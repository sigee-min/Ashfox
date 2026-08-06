import {
  animationSupportForFormatProfile,
  type ProjectDocument,
  type ProductionReadinessReport
} from '@ashfox/engine-core';

import {
  deliveryVisualReviewsForRevision,
  visualReviewPlanItem,
  type VisualReviewReceipt
} from '../../application/visualReviewReceipt';

/*
 * Reviews follow the configured delivery profile, while the document remains
 * the canonical authoring source. Static targets therefore keep source clips
 * without asking the user to review motion that cannot appear in the artifact.
 */
const animationReviewClipIds = (
  document: ProjectDocument
): readonly string[] =>
  animationSupportForFormatProfile(document.formatProfile) === 'none'
    ? []
    : Object.keys(document.animations).sort();

export type VisualReviewCamera =
  | 'perspective'
  | 'native'
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
  'native',
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
  ...animationReviewClipIds(document)
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
    deliveryVisualReviewsForRevision(
      receipts,
      document.id,
      document.revision
    ).flatMap((receipt) => {
      if (receipt.decision.verdict !== 'accepted') return [];
      if (
        receipt.observation.data.mode === 'cycle' &&
        receipt.observation.data.completedCycles < 1
      ) {
        return [];
      }
      return [visualReviewKey(visualReviewPlanItem(receipt))];
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
