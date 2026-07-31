'use client';

import {
  useEffect,
  type Dispatch
} from 'react';

import {
  compareProjectRevisions,
  isValidLocalProjectRecord,
  type LocalProjectRecord
} from '../../../application/localProjectRecord';
import {
  loadLocalProject
} from './indexedDbProjectRepository';
import {
  rebaseLocalProject,
  requiresAuthoritativeRebase
} from './localProjectRebase';
import type {
  PersistenceSessionAction,
  PersistenceSessionIdentity
} from './persistenceSessionState';
import type {
  PersistenceLifecycle
} from './usePersistenceLifecycle';
import {
  subscribeLocalProject
} from './projectRevisionChannel';

interface UseLocalProjectRestoreInput {
  enabled: boolean;
  projectId: string;
  projectGeneration: number;
  restoreFromStorage: boolean;
  session: PersistenceSessionIdentity;
  lifecycle: PersistenceLifecycle;
  dispatch: Dispatch<PersistenceSessionAction>;
  onHydrate: (record: LocalProjectRecord) => void;
  onExternal: (record: LocalProjectRecord) => void;
}

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
    currentAssets,
    currentActivity,
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
      dispatch({
        type: 'ready',
        session,
        lastSavedAt: null
      });
      return;
    }

    void loadLocalProject(projectId)
      .then((record) => {
        if (disposed || sessionId !== sessionRef.current) return;
        if (record) {
          if (!isValidLocalProjectRecord(record, projectId)) {
            dispatch({
              type: 'error',
              session,
              ready: false
            });
            return;
          }
          if (authoritative) {
            const document = currentDocument.current;
            if (
              requiresAuthoritativeRebase(
                document,
                currentAssets.current,
                record
              )
            ) {
              onHydrate(
                rebaseLocalProject(
                  document,
                  currentAssets.current,
                  currentActivity.current,
                  record
                )
              );
            }
          } else if (
            currentDocument.current === baselineDocument &&
            currentDocument.current.id === projectId
          ) {
            onHydrate(record);
          }
        }
        dispatch({
          type: 'ready',
          session,
          lastSavedAt: authoritative ? null : record?.savedAt ?? null
        });
      })
      .catch(() => {
        if (!disposed && sessionId === sessionRef.current) {
          dispatch({
            type: 'error',
            session,
            ready: false
          });
        }
      });

    const unsubscribe = subscribeLocalProject(projectId, (record) => {
      if (
        disposed ||
        sessionId !== sessionRef.current ||
        authoritative ||
        !isValidLocalProjectRecord(record, projectId) ||
        compareProjectRevisions(
          record.revision,
          currentDocument.current.revision
        ) <= 0
      ) {
        return;
      }
      onExternal(record);
      dispatch({
        type: 'saved',
        session,
        lastSavedAt: record.savedAt
      });
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
