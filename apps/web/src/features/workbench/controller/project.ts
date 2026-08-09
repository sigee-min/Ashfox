'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState
} from 'react';

import {
  validateProjectDocument,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createHistoryState,
  type HistoryAction
} from '../../../application/historyReducer';
import {
  createProjectSnapshot,
  type ProjectSnapshot
} from '../../../application/snapshot';
import {
  createOperationLease
} from '../../../application/operationLease';
import type {
  VisualReviewReceipt
} from '../../../application/review';
import {
  createBlankWorkbenchProject
} from '../newProject';
import {
  useLocalProjectPersistence
} from '../persistence/project';
import {
  createProjectSessionState,
  projectSessionReducer
} from '../state/session';

const createInitialProject = () => ({
  history: createHistoryState(
    createBlankWorkbenchProject(new Date().toISOString())
  )
});

export const useWorkbenchProjectSession = () => {
  const [operationLease] = useState(createOperationLease);
  const [initialProject] = useState(createInitialProject);
  const [project, dispatchProject] = useReducer(
    projectSessionReducer,
    initialProject,
    ({ history }) => createProjectSessionState(history, {})
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
    record: ProjectSnapshot
  ): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject({ type: 'hydrate', record });
  }, [operationLease]);

  const receiveExternalProject = useCallback((
    record: ProjectSnapshot
  ): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject({ type: 'external', record });
  }, [operationLease]);

  const storageStatus = useLocalProjectPersistence({
    enabled: true,
    projectId: document.id,
    projectGeneration: storage.generation,
    restoreFromStorage: storage.restoreFromStorage,
    document,
    onHydrate: hydrateProject,
    onExternal: receiveExternalProject
  }).status;

  const replaceProject = useCallback((
    opened: ProjectDocument
  ): void => {
    const savedAt = new Date().toISOString();
    dispatchProject({
      type: 'replace',
      record: createProjectSnapshot(opened, savedAt)
    });
  }, []);

  const recordVisualReview = useCallback((
    receipt: VisualReviewReceipt
  ): void => {
    dispatchProject({ type: 'visualReview.record', receipt });
  }, []);

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
    operationLease,
    dispatchProject,
    dispatchUserMutation,
    recordVisualReview,
    replaceProject
  };
};
