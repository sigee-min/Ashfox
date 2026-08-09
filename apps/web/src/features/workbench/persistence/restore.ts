'use client';

import {
  useEffect,
  type Dispatch
} from 'react';

import {
  compareProjectRevisions,
  type LocalProjectRecord
} from '../../../application/localProjectRecord';
import {
  createProjectSnapshot,
  type ProjectSnapshot
} from '../../../application/snapshot';
import {
  openProjectSource
} from '../../files/source';
import {
  loadLocalProject
} from './repository';
import type {
  PersistenceSessionAction,
  PersistenceSessionIdentity
} from './session';
import type {
  PersistenceLifecycle
} from './lifecycle';
import {
  subscribeLocalProject
} from './revision';

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
  record: LocalProjectRecord
): ProjectSnapshot => createProjectSnapshot(
  openProjectSource(record.source, {
    id: record.projectId,
    revision: record.revision,
    createdAt: record.createdAt
  }),
  record.savedAt
);

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
  const {
    currentDocument,
    session: sessionRef,
    saveRequest
  } = lifecycle;

  useEffect(() => {
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    saveRequest.current += 1;
    let disposed = false;
    const baselineDocument = currentDocument.current;
    const authoritative = !restoreFromStorage;
    dispatch({ type: 'begin', session, authoritative });
    if (!enabled) {
      dispatch({ type: 'ready', session, lastSavedAt: null });
      return;
    }

    void loadLocalProject(projectId)
      .then((record) => {
        if (disposed || sessionId !== sessionRef.current) return;
        if (
          record &&
          !authoritative &&
          currentDocument.current === baselineDocument &&
          currentDocument.current.id === projectId
        ) {
          onHydrate(materializeRecord(record));
        }
        dispatch({
          type: 'ready',
          session,
          lastSavedAt: authoritative ? null : record?.savedAt ?? null
        });
      })
      .catch(() => {
        if (!disposed && sessionId === sessionRef.current) {
          dispatch({ type: 'error', session, ready: false });
        }
      });

    const unsubscribe = subscribeLocalProject(projectId, (record) => {
      if (
        disposed ||
        sessionId !== sessionRef.current ||
        authoritative ||
        compareProjectRevisions(
          record.revision,
          currentDocument.current.revision
        ) <= 0
      ) {
        return;
      }
      try {
        onExternal(materializeRecord(record));
        dispatch({
          type: 'saved',
          session,
          lastSavedAt: record.savedAt
        });
      } catch {
        dispatch({ type: 'error', session });
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [
    onExternal,
    onHydrate,
    enabled,
    projectGeneration,
    projectId,
    restoreFromStorage
  ]);
};
