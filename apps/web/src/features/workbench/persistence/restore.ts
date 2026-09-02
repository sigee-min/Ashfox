'use client';

import { useEffect, type Dispatch } from 'react';

import { openAssetProject } from '@ashfox/engine-core';
import {
  compareProjectRevisions,
  type LocalProjectRecord as StoredLocalProjectRecord
} from '../../../application/localProjectRecord';
import { createProjectSnapshot, type ProjectSnapshot } from '../../../application/snapshot';
import { loadLocalProject } from './repository';
import type { PersistenceSessionAction, PersistenceSessionIdentity } from './session';
import type { PersistenceLifecycle } from './lifecycle';
import { subscribeLocalProject } from './revision';

interface UseLocalProjectRestoreInput {
  enabled: boolean;
  projectId: string;
  projectGeneration: number;
  restoreFromStorage: boolean;
  session: PersistenceSessionIdentity;
  lifecycle: PersistenceLifecycle;
  dispatch: Dispatch<PersistenceSessionAction>;
  onHydrate: (record: ProjectSnapshot) => void;
  onExternal: (record: ProjectSnapshot) => void;
}

const materializeRecord = (
  record: StoredLocalProjectRecord
): ProjectSnapshot => {
  const opened = openAssetProject({
    workspace: record.workspace,
    entry: record.entry,
    identity: {
      id: record.projectId,
      revision: record.revision,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }
  });
  if (!opened.ok) {
    const first = opened.diagnostics[0];
    throw new Error(first?.message ?? 'Stored workspace could not be opened.');
  }
  return createProjectSnapshot(opened.project, record.savedAt);
};

export const useLocalProjectRestore = ({
  enabled,
  projectId,
  projectGeneration,
  restoreFromStorage,
  session,
  lifecycle,
  dispatch,
  onHydrate,
  onExternal
}: UseLocalProjectRestoreInput): void => {
  const { currentProject, session: sessionRef, saveRequest } = lifecycle;

  useEffect(() => {
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    saveRequest.current += 1;
    let disposed = false;
    const baselineProject = currentProject.current;
    const authoritative = !restoreFromStorage;
    dispatch({ type: 'begin', session, authoritative });
    if (!enabled) {
      dispatch({ type: 'ready', session, lastSavedAt: null });
      return;
    }

    void loadLocalProject(projectId)
      .then((record) => {
        if (disposed || sessionId !== sessionRef.current) return;
        if (record && !authoritative && currentProject.current === baselineProject &&
          currentProject.current.id === projectId) {
          onHydrate(materializeRecord(record));
        }
        dispatch({
          type: 'ready', session,
          lastSavedAt: authoritative ? null : record?.savedAt ?? null
        });
      })
      .catch(() => {
        if (!disposed && sessionId === sessionRef.current) {
          dispatch({ type: 'error', session, ready: false });
        }
      });

    const unsubscribe = subscribeLocalProject(projectId, (record) => {
      if (disposed || sessionId !== sessionRef.current || authoritative ||
        compareProjectRevisions(record.revision, currentProject.current.revision) <= 0) {
        return;
      }
      try {
        onExternal(materializeRecord(record));
        dispatch({ type: 'saved', session, lastSavedAt: record.savedAt });
      } catch {
        dispatch({ type: 'error', session });
      }
    });
    return () => { disposed = true; unsubscribe(); };
  }, [onExternal, onHydrate, enabled, projectGeneration, projectId, restoreFromStorage]);
};
