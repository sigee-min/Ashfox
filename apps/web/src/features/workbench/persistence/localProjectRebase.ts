import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import {
  areProjectDocumentsEqual,
  compareProjectRevisions,
  createLocalProjectRecord,
  localProjectRevisionForSerial,
  projectRevisionSerial,
  type LocalProjectRecord
} from '../../../application/localProjectRecord';
import {
  areProjectAssetsEqual,
  type ProjectAssets
} from '../../../application/projectAssets';
import {
  areVisualReviewLedgersEqual,
  type VisualReviewReceipt
} from '../../../application/visualReviewReceipt';

export const rebaseLocalProject = (
  document: ProjectDocument,
  assets: ProjectAssets,
  activity: readonly CommandReceipt[],
  existing: LocalProjectRecord
): LocalProjectRecord => {
  const savedAt = new Date().toISOString();
  const serial = Math.max(
    projectRevisionSerial(document.revision),
    projectRevisionSerial(existing.revision)
  ) + 1;
  const revision = localProjectRevisionForSerial(serial);
  return createLocalProjectRecord({
    document: {
      ...document,
      revision,
      updatedAt: savedAt
    },
    assets,
    activity,
    visualReviews: [],
    savedAt
  });
};

export const requiresAuthoritativeRebase = (
  document: ProjectDocument,
  assets: ProjectAssets,
  visualReviews: readonly VisualReviewReceipt[],
  existing: LocalProjectRecord
): boolean => {
  const order = compareProjectRevisions(
    document.revision,
    existing.revision
  );
  return order < 0 || (
    order === 0 &&
    (
      document.revision !== existing.revision ||
      !areProjectDocumentsEqual(document, existing.document) ||
      !areProjectAssetsEqual(assets, existing.assets) ||
      !areVisualReviewLedgersEqual(
        visualReviews,
        existing.visualReviews
      )
    )
  );
};
