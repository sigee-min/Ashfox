'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState
} from 'react';

import { validateProjectDocument } from '@ashfox/engine-core';

import {
  createHistoryState,
  type HistoryAction
} from '../../../application/historyReducer';
import {
  createLocalProjectRecord,
  type LocalProjectRecord
} from '../../../application/localProjectRecord';
import {
  createOperationLease
} from '../../../application/operationLease';
import type {
  VisualReviewReceipt
} from '../../../application/visualReviewReceipt';
import type {
  ProjectArchiveFile
} from '../../files/projectArchive';
import {
  createBlankWorkbenchProject
} from '../newProject';
import {
  useLocalProjectPersistence
} from '../persistence/useLocalProjectPersistence';
import {
  createProjectSessionState,
  projectSessionReducer
} from '../state/projectSessionReducer';
import {
  loadGalleryProject,
  resolveGalleryProjectUrl
} from './galleryProjectLoader';

export type GalleryProjectLoadPhase =
  'idle' | 'loading' | 'loaded' | 'error';

interface GalleryProjectLoadStatus {
  phase: GalleryProjectLoadPhase;
  message: string;
}

const createInitialProject = () => {
  const search =
    typeof window === 'undefined' ? '' : window.location.search;
  const projectUrl = typeof window === 'undefined'
    ? null
    : resolveGalleryProjectUrl(search, window.location.origin);
  return {
    projectUrl,
    history: createHistoryState(
      createBlankWorkbenchProject(new Date().toISOString())
    ),
    isShowcase: projectUrl !== null
  };
};

export const useWorkbenchProjectSession = () => {
  const [operationLease] = useState(createOperationLease);
  const [initialProject] = useState(createInitialProject);
  const [galleryProjectStatus, setGalleryProjectStatus] =
    useState<GalleryProjectLoadStatus>(() => initialProject.projectUrl
      ? { phase: 'loading', message: 'Opening demo project…' }
      : { phase: 'idle', message: '' });
  const [project, dispatchProject] = useReducer(
    projectSessionReducer,
    initialProject,
    ({ history, isShowcase }) =>
      createProjectSessionState(history, {}, !isShowcase)
  );
  const { history, assets, visualReviews, storage } = project;
  const document = history.present;

  const report = useMemo(
    () => validateProjectDocument(document),
    [document]
  );
  const buildCaptureDocuments = useMemo(
    () => [...history.past, document],
    [document, history.past]
  );

  const dispatchUserMutation = useCallback((
    action: HistoryAction
  ): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject(action);
  }, [operationLease]);

  const hydrateProject = useCallback((
    record: LocalProjectRecord
  ): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject({ type: 'hydrate', record });
  }, [operationLease]);

  const receiveExternalProject = useCallback((
    record: LocalProjectRecord
  ): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject({ type: 'external', record });
  }, [operationLease]);

  const storageStatus = useLocalProjectPersistence({
    enabled: !initialProject.isShowcase,
    projectId: document.id,
    projectGeneration: storage.generation,
    restoreFromStorage: storage.restoreFromStorage,
    document,
    assets,
    activity: history.activity,
    visualReviews,
    onHydrate: hydrateProject,
    onExternal: receiveExternalProject
  }).status;

  const replaceProject = useCallback((
    archive: ProjectArchiveFile
  ): void => {
    const savedAt = new Date().toISOString();
    dispatchProject({
      type: 'replace',
      record: createLocalProjectRecord({
        document: archive.document,
        assets: archive.assets,
        activity: [],
        visualReviews: [],
        savedAt
      })
    });
  }, []);

  const recordVisualReview = useCallback((
    receipt: VisualReviewReceipt
  ): void => {
    dispatchProject({ type: 'visualReview.record', receipt });
  }, []);

  useEffect(() => {
    if (!initialProject.projectUrl) return undefined;
    const controller = new AbortController();
    setGalleryProjectStatus({
      phase: 'loading',
      message: 'Opening demo project…'
    });
    void loadGalleryProject(
      initialProject.projectUrl,
      controller.signal
    ).then((archive) => {
      replaceProject(archive);
      setGalleryProjectStatus({
        phase: 'loaded',
        message: 'Demo project opened.'
      });
    }).catch((error: unknown) => {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        return;
      }
      setGalleryProjectStatus({
        phase: 'error',
        message: error instanceof Error
          ? `Could not open demo: ${error.message}`
          : 'Could not open demo project.'
      });
    });
    return () => controller.abort();
  }, [initialProject.projectUrl, replaceProject]);

  return {
    initialSelectionId: null,
    initialClipId:
      Object.keys(initialProject.history.present.animations)[0] ?? null,
    document,
    history,
    assets,
    visualReviews,
    storage,
    report,
    buildCaptureDocuments,
    storageStatus,
    galleryProjectStatus,
    operationLease,
    dispatchProject,
    dispatchUserMutation,
    recordVisualReview,
    replaceProject
  };
};
