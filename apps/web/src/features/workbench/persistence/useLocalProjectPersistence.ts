'use client';

import {
  useEffect,
  useRef,
  useState
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

export type StorageStatus = 'loading' | 'saving' | 'saved' | 'error';

interface UseLocalProjectPersistenceInput {
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

interface PersistenceSessionState extends LocalProjectPersistenceState {
  projectId: string;
  projectGeneration: number;
  authoritative: boolean;
  ready: boolean;
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
  return {
    schemaVersion: 1,
    projectId: document.id,
    revision,
    document: {
      ...document,
      revision,
      updatedAt: savedAt
    },
    assets,
    activity,
    savedAt
  };
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
  projectId,
  projectGeneration,
  restoreFromStorage,
  document,
  assets,
  activity,
  onHydrate,
  onExternal
}: UseLocalProjectPersistenceInput): LocalProjectPersistenceState => {
  const [persistence, setPersistence] = useState<PersistenceSessionState>({
    projectId,
    projectGeneration,
    authoritative: !restoreFromStorage,
    ready: false,
    status: 'loading',
    lastSavedAt: null
  });
  const currentDocumentRef = useRef(document);
  const currentAssetsRef = useRef(assets);
  const currentActivityRef = useRef(activity);
  const sessionRef = useRef(0);
  const saveRequestRef = useRef(0);
  currentDocumentRef.current = document;
  currentAssetsRef.current = assets;
  currentActivityRef.current = activity;

  useEffect(() => {
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    saveRequestRef.current += 1;
    let disposed = false;
    const baselineDocument = currentDocumentRef.current;
    const authoritative = !restoreFromStorage;
    setPersistence({
      projectId,
      projectGeneration,
      authoritative,
      ready: false,
      status: 'loading',
      lastSavedAt: null
    });

    void loadLocalProject(projectId)
      .then((record) => {
        if (disposed || sessionId !== sessionRef.current) return;
        if (record) {
          if (!isValidLocalProjectRecord(record, projectId)) {
            setPersistence({
              projectId,
              projectGeneration,
              authoritative,
              ready: true,
              status: 'error',
              lastSavedAt: null
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
        setPersistence({
          projectId,
          projectGeneration,
          authoritative,
          ready: true,
          status: 'saved',
          lastSavedAt: authoritative ? null : record?.savedAt ?? null
        });
      })
      .catch(() => {
        if (
          !disposed &&
          sessionId === sessionRef.current
        ) {
          setPersistence({
            projectId,
            projectGeneration,
            authoritative,
            ready: false,
            status: 'error',
            lastSavedAt: null
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
      setPersistence({
        projectId,
        projectGeneration,
        authoritative: false,
        ready: true,
        status: 'saved',
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
    projectGeneration,
    projectId,
    restoreFromStorage
  ]);

  useEffect(() => {
    if (
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
      setPersistence((current) =>
        current.projectId === projectId
          ? { ...current, status: 'saving' }
          : current
      );
      const savedAt = new Date().toISOString();
      const record: LocalProjectRecord = {
        schemaVersion: 1,
        projectId,
        revision: document.revision,
        document,
        assets,
        activity,
        savedAt
      };

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
              setPersistence({
                projectId,
                projectGeneration,
                authoritative: false,
                ready: true,
                status: 'saved',
                lastSavedAt: result.current.savedAt
              });
              return;
            }
            setPersistence((current) =>
              current.projectId === projectId
                ? { ...current, status: 'error' }
                : current
            );
            return;
          }
          setPersistence({
            projectId,
            projectGeneration,
            authoritative: false,
            ready: true,
            status: 'saved',
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
            setPersistence((current) =>
              current.projectId === projectId
                ? { ...current, status: 'error' }
                : current
            );
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
    onExternal,
    onHydrate,
    persistence.projectId,
    persistence.projectGeneration,
    persistence.authoritative,
    persistence.ready,
    projectGeneration,
    projectId
  ]);

  return (
    persistence.projectId === projectId &&
    persistence.projectGeneration === projectGeneration
  )
    ? {
        status: persistence.status,
        lastSavedAt: persistence.lastSavedAt
      }
    : {
        status: 'loading',
        lastSavedAt: null
      };
};
