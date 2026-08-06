'use client';

import {
  useRef
} from 'react';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  ProjectAssets
} from '../../../application/projectAssets';
import type {
  VisualReviewReceipt
} from '../../../application/visualReviewReceipt';
import {
  useLatestValue
} from '../../../hooks/useLatestValue';

export const usePersistenceLifecycle = (
  document: ProjectDocument,
  assets: ProjectAssets,
  activity: readonly CommandReceipt[],
  visualReviews: readonly VisualReviewReceipt[]
) => {
  const currentDocument = useLatestValue(document);
  const currentAssets = useLatestValue(assets);
  const currentActivity = useLatestValue(activity);
  const currentVisualReviews = useLatestValue(visualReviews);
  const session = useRef(0);
  const saveRequest = useRef(0);
  return {
    currentDocument,
    currentAssets,
    currentActivity,
    currentVisualReviews,
    session,
    saveRequest
  };
};

export type PersistenceLifecycle = ReturnType<
  typeof usePersistenceLifecycle
>;
