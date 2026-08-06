'use client';

import {
  useReducer
} from 'react';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  LocalProjectRecord
} from '../../../application/localProjectRecord';
import type {
  ProjectAssets
} from '../../../application/projectAssets';
import type {
  VisualReviewReceipt
} from '../../../application/visualReviewReceipt';
import {
  createPersistenceSessionState,
  isPersistenceSession,
  persistenceSessionReducer,
  type StorageStatus
} from './persistenceSessionState';
import {
  useLocalProjectRestore
} from './useLocalProjectRestore';
import {
  useLocalProjectSave
} from './useLocalProjectSave';
import {
  usePersistenceLifecycle
} from './usePersistenceLifecycle';

export type { StorageStatus } from './persistenceSessionState';

interface UseLocalProjectPersistenceInput {
  enabled?: boolean;
  projectId: string;
  projectGeneration: number;
  restoreFromStorage: boolean;
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  visualReviews: readonly VisualReviewReceipt[];
  onHydrate: (record: LocalProjectRecord) => void;
  onExternal: (record: LocalProjectRecord) => void;
}

interface LocalProjectPersistenceState {
  status: StorageStatus;
  lastSavedAt: string | null;
}

export const useLocalProjectPersistence = ({
  enabled = true,
  projectId,
  projectGeneration,
  restoreFromStorage,
  document,
  assets,
  activity,
  visualReviews,
  onHydrate,
  onExternal
}: UseLocalProjectPersistenceInput): LocalProjectPersistenceState => {
  const session = { projectId, projectGeneration };
  const [persistence, dispatch] = useReducer(
    persistenceSessionReducer,
    undefined,
    () => createPersistenceSessionState(
      session,
      !restoreFromStorage
    )
  );
  const lifecycle = usePersistenceLifecycle(
    document,
    assets,
    activity,
    visualReviews
  );

  useLocalProjectRestore({
    enabled,
    projectId,
    projectGeneration,
    restoreFromStorage,
    session,
    lifecycle,
    dispatch,
    onHydrate,
    onExternal
  });
  useLocalProjectSave({
    enabled,
    projectId,
    projectGeneration,
    session,
    persistence,
    document,
    assets,
    activity,
    visualReviews,
    lifecycle,
    dispatch,
    onHydrate,
    onExternal
  });

  return isPersistenceSession(persistence, session)
    ? {
        status: persistence.status,
        lastSavedAt: persistence.lastSavedAt
      }
    : {
        status: 'loading',
        lastSavedAt: null
      };
};
