import type {
  AssetProject,
  CommandReceipt
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from './review';

/** Ephemeral Workbench state reconstructed from the active AssetProject. */
export interface ProjectSnapshot {
  readonly project: AssetProject;
  readonly activity: readonly CommandReceipt[];
  readonly visualReviews: readonly VisualReviewReceipt[];
  readonly savedAt: string;
}

export const createProjectSnapshot = (
  project: AssetProject,
  savedAt: string,
  activity: readonly CommandReceipt[] = [],
  visualReviews: readonly VisualReviewReceipt[] = []
): ProjectSnapshot => ({
  project,
  activity,
  visualReviews,
  savedAt
});

export const areAssetProjectsEqual = (
  left: AssetProject,
  right: AssetProject
): boolean => left === right || JSON.stringify(left) === JSON.stringify(right);
