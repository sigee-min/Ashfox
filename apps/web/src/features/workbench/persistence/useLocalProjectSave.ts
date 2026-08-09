'use client';

import {
  useEffect,
  type Dispatch
} from 'react';

import {
  serializeProjectFile,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createLocalProjectRecord
} from '../../../application/localProjectRecord';
import {
  saveLocalProject
} from './repository';
import type {
  PersistenceSessionAction,
  PersistenceSessionIdentity,
  PersistenceSessionState
} from './session';
import {
  publishLocalRevision
} from './revision';
import type {
  PersistenceLifecycle
} from './lifecycle';

interface UseLocalProjectSaveInput {
  enabled: boolean;
  projectId: string;
  projectGeneration: number;
  session: PersistenceSessionIdentity;
  persistence: PersistenceSessionState;
  document: ProjectDocument;
  lifecycle: PersistenceLifecycle;
  dispatch: Dispatch<PersistenceSessionAction>;
}

export const useLocalProjectSave = ({
  enabled,
  projectId,
  projectGeneration,
  session,
  persistence,
  document,
  lifecycle,
  dispatch
}: UseLocalProjectSaveInput): void => {
  const {
    session: sessionRef,
    saveRequest
  } = lifecycle;

  useEffect(() => {
    if (
      !enabled ||
      persistence.projectId !== projectId ||
      persistence.projectGeneration !== projectGeneration ||
      !persistence.ready ||
      !document.intentProgram ||
      document.intentProgramProposal
    ) {
      return;
    }
    const serialized = serializeProjectFile(document);
    if (!serialized.ok) {
      dispatch({ type: 'error', session });
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
        projectId: document.id,
        revision: document.revision,
        createdAt: document.createdAt,
        source: serialized.source,
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
          if (
            result.status === 'blocked' ||
            result.status === 'conflict'
          ) {
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
    document,
    enabled,
    persistence.projectId,
    persistence.projectGeneration,
    persistence.ready,
    projectGeneration,
    projectId
  ]);
};
