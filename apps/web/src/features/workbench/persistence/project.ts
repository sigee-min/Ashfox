'use client';

import { useReducer } from 'react';

import type { AssetProject } from '@ashfox/engine-core';
import type { ProjectSnapshot } from '../../../application/snapshot';
import {
  createPersistenceSessionState,
  isPersistenceSession,
  persistenceSessionReducer,
  type StorageStatus
} from './session';
import { useLocalProjectRestore } from './restore';
import { useLocalProjectSave } from './useLocalProjectSave';
import { usePersistenceLifecycle } from './lifecycle';

export type { StorageStatus } from './session';

interface UseLocalProjectPersistenceInput {
  enabled?: boolean;
  projectId: string;
  projectGeneration: number;
  restoreFromStorage: boolean;
  project: AssetProject;
  onHydrate: (record: ProjectSnapshot) => void;
  onExternal: (record: ProjectSnapshot) => void;
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
  project,
  onHydrate,
  onExternal
}: UseLocalProjectPersistenceInput): LocalProjectPersistenceState => {
  const session = { projectId, projectGeneration };
  const [persistence, dispatch] = useReducer(
    persistenceSessionReducer,
    undefined,
    () => createPersistenceSessionState(session, !restoreFromStorage)
  );
  const lifecycle = usePersistenceLifecycle(project);

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
    project,
    lifecycle,
    dispatch
  });

  return isPersistenceSession(persistence, session)
    ? { status: persistence.status, lastSavedAt: persistence.lastSavedAt }
    : { status: 'loading', lastSavedAt: null };
};
