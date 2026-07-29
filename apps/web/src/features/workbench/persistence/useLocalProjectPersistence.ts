'use client';

import {
  useEffect,
  useReducer,
  useRef,
} from 'react';

import {
  type CommandReceipt,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  loadLocalProject,
  saveLocalProject
} from './indexedDbProjectRepository';
import type { LocalProjectRecord } from './localProjectRecord';
import {
  areProjectDocumentsEqual,
  compareProjectRevisions,
  createLocalProjectRecord,
  isValidLocalProjectRecord,
  localProjectRevisionForSerial,
  projectRevisionSerial
} from './localProjectRecord';
import {
  publishLocalRevision,
  subscribeLocalProject
} from './projectRevisionChannel';
import {
  areProjectAssetsEqual,
  type ProjectAssets
} from '../../files/projectAssets';
import { useLatestValue } from '../../../hooks/useLatestValue';
import {
  createPersistenceSessionState,
  isPersistenceSession,
  persistenceSessionReducer,
  type StorageStatus
} from './persistenceSessionState';

export type { StorageStatus } from './persistenceSessionState';

interface UseLocalProjectPersistenceInput {
  enabled?: boolean;
  projectId: string;
  projectGeneration: number;
  restoreFromStorage: boolean;
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  onHydrate: (record: LocalProjectRecord) => void;
  onExternal: (record: LocalProjectRecord) => void;
}

interface LocalProjectPersistenceState {
  status: StorageStatus;
  lastSavedAt: string | null;
}

const rebaseLocalProject = (
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
    savedAt
  });
};

const requiresAuthoritativeRebase = (
  document: ProjectDocument,
  assets: ProjectAssets,
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
      !areProjectAssetsEqual(assets, existing.assets)
    )
  );
};

export const useLocalProjectPersistence = ({
  enabled = true,
  projectId,
  projectGeneration,
  restoreFromStorage,
  document,
  assets,
  activity,
  onHydrate,
  onExternal
}: UseLocalProjectPersistenceInput): LocalProjectPersistenceState => {
  const session = { projectId, projectGeneration };
  const [persistence, dispatchPersistence] = useReducer(
    persistenceSessionReducer,
    undefined,
    () => createPersistenceSessionState(
      session,
      !restoreFromStorage
    )
  );
  const currentDocumentRef = useLatestValue(document);
  const currentAssetsRef = useLatestValue(assets);
  const currentActivityRef = useLatestValue(activity);
  const sessionRef = useRef(0);
  const saveRequestRef = useRef(0);

  useEffect(() => {
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    saveRequestRef.current += 1;
    let disposed = false;
    const baselineDocument = currentDocumentRef.current;
    const authoritative = !restoreFromStorage;
    dispatchPersistence({
      type: 'begin',
      session,
      authoritative,
    });
    if (!enabled) {
      dispatchPersistence({
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
            dispatchPersistence({
              type: 'error',
              session,
              ready: true
            });
            return;
          }
          if (authoritative) {
            const currentDocument = currentDocumentRef.current;
            if (
              requiresAuthoritativeRebase(
                currentDocument,
                currentAssetsRef.current,
                record
              )
            ) {
              onHydrate(
                rebaseLocalProject(
                  currentDocument,
                  currentAssetsRef.current,
                  currentActivityRef.current,
                  record
                )
              );
            }
          } else if (
            currentDocumentRef.current === baselineDocument &&
            currentDocumentRef.current.id === projectId
          ) {
            onHydrate(record);
          }
        }
        dispatchPersistence({
          type: 'ready',
          session,
          lastSavedAt: authoritative ? null : record?.savedAt ?? null
        });
      })
      .catch(() => {
        if (
          !disposed &&
          sessionId === sessionRef.current
        ) {
          dispatchPersistence({
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
          currentDocumentRef.current.revision
        ) <= 0
      ) {
        return;
      }
      onExternal(record);
      dispatchPersistence({
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

  useEffect(() => {
    if (
      !enabled ||
      persistence.projectId !== projectId ||
      persistence.projectGeneration !== projectGeneration ||
      !persistence.ready
    ) {
      return;
    }
    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    const sessionId = sessionRef.current;
    let disposed = false;

    const timer = window.setTimeout(() => {
      if (disposed || sessionId !== sessionRef.current) return;
      dispatchPersistence({ type: 'saving', session });
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
            requestId !== saveRequestRef.current
          ) {
            return;
          }
          if (result.status === 'conflict') {
            if (persistence.authoritative) {
              onHydrate(
                rebaseLocalProject(
                  currentDocumentRef.current,
                  currentAssetsRef.current,
                  currentActivityRef.current,
                  result.current
                )
              );
              return;
            }
            if (
              isValidLocalProjectRecord(result.current, projectId) &&
              compareProjectRevisions(
                result.current.revision,
                currentDocumentRef.current.revision
              ) > 0
            ) {
              onExternal(result.current);
              dispatchPersistence({
                type: 'saved',
                session,
                lastSavedAt: result.current.savedAt
              });
              return;
            }
            dispatchPersistence({ type: 'error', session });
            return;
          }
          dispatchPersistence({
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
            requestId === saveRequestRef.current
          ) {
            dispatchPersistence({ type: 'error', session });
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
