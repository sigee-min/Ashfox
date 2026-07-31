'use client';

import {
  useEffect,
  type Dispatch
} from 'react';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import {
  compareProjectRevisions,
  createLocalProjectRecord,
  isValidLocalProjectRecord,
  type LocalProjectRecord
} from '../../../application/localProjectRecord';
import type {
  ProjectAssets
} from '../../../application/projectAssets';
import {
  saveLocalProject
} from './indexedDbProjectRepository';
import {
  rebaseLocalProject
} from './localProjectRebase';
import type {
  PersistenceSessionAction,
  PersistenceSessionIdentity,
  PersistenceSessionState
} from './persistenceSessionState';
import {
  publishLocalRevision
} from './projectRevisionChannel';
import type {
  PersistenceLifecycle
} from './usePersistenceLifecycle';

interface UseLocalProjectSaveInput {
  enabled: boolean;
  projectId: string;
  projectGeneration: number;
  session: PersistenceSessionIdentity;
  persistence: PersistenceSessionState;
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  lifecycle: PersistenceLifecycle;
  dispatch: Dispatch<PersistenceSessionAction>;
  onHydrate: (record: LocalProjectRecord) => void;
  onExternal: (record: LocalProjectRecord) => void;
}

export const useLocalProjectSave = ({
  enabled,
  projectId,
  projectGeneration,
  session,
  persistence,
  document,
  assets,
  activity,
  lifecycle,
  dispatch,
  onHydrate,
  onExternal
}: UseLocalProjectSaveInput): void => {
  const {
    currentDocument,
    currentAssets,
    currentActivity,
    session: sessionRef,
    saveRequest
  } = lifecycle;

  useEffect(() => {
    if (
      !enabled ||
      persistence.projectId !== projectId ||
      persistence.projectGeneration !== projectGeneration ||
      !persistence.ready
    ) {
      return;
    }
    const requestId = saveRequest.current + 1;
    saveRequest.current = requestId;
    const sessionId = sessionRef.current;
    let disposed = false;

    const timer = window.setTimeout(() => {
      if (disposed || sessionId !== sessionRef.current) return;
      dispatch({ type: 'saving', session });
      const savedAt = new Date().toISOString();
      const record = createLocalProjectRecord({
        document,
        assets,
        activity,
        savedAt
      });

      void saveLocalProject(record)
        .then((result) => {
          if (
            disposed ||
            sessionId !== sessionRef.current ||
            requestId !== saveRequest.current
          ) {
            return;
          }
          if (result.status === 'blocked') {
            dispatch({
              type: 'error',
              session,
              ready: false
            });
            return;
          }
          if (result.status === 'conflict') {
            if (persistence.authoritative) {
              onHydrate(
                rebaseLocalProject(
                  currentDocument.current,
                  currentAssets.current,
                  currentActivity.current,
                  result.current
                )
              );
              return;
            }
            if (
              isValidLocalProjectRecord(result.current, projectId) &&
              compareProjectRevisions(
                result.current.revision,
                currentDocument.current.revision
              ) > 0
            ) {
              onExternal(result.current);
              dispatch({
                type: 'saved',
                session,
                lastSavedAt: result.current.savedAt
              });
              return;
            }
            dispatch({ type: 'error', session });
            return;
          }
          dispatch({
            type: 'saved',
            session,
            lastSavedAt: result.current.savedAt
          });
          if (result.status === 'stored') {
            publishLocalRevision({
              projectId,
              revision: document.revision
            });
          }
        })
        .catch(() => {
          if (
            !disposed &&
            sessionId === sessionRef.current &&
            requestId === saveRequest.current
          ) {
            dispatch({ type: 'error', session });
          }
        });
    }, 140);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [
    activity,
    assets,
    document,
    enabled,
    onExternal,
    onHydrate,
    persistence.projectId,
    persistence.projectGeneration,
    persistence.authoritative,
    persistence.ready,
    projectGeneration,
    projectId
  ]);
};
