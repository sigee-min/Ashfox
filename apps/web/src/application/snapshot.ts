import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from './review';

/** Ephemeral Workbench state reconstructed from source or the active session. */
export interface ProjectSnapshot {
  readonly document: ProjectDocument;
  readonly activity: readonly CommandReceipt[];
  readonly visualReviews: readonly VisualReviewReceipt[];
  readonly savedAt: string;
}

export const createProjectSnapshot = (
  document: ProjectDocument,
  savedAt: string,
  activity: readonly CommandReceipt[] = [],
  visualReviews: readonly VisualReviewReceipt[] = []
): ProjectSnapshot => ({
  document,
  activity,
  visualReviews,
  savedAt
});

export const areProjectDocumentsEqual = (
  left: ProjectDocument,
  right: ProjectDocument
): boolean => left === right || JSON.stringify(left) === JSON.stringify(right);
