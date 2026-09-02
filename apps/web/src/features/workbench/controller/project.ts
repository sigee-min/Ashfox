'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';
import { validateProjectDocument, type AssetProject } from '@ashfox/engine-core';
import { createHistoryState, type HistoryAction } from '../../../application/historyReducer';
import { createProjectSnapshot, type ProjectSnapshot } from '../../../application/snapshot';
import { createOperationLease } from '../../../application/operationLease';
import type { VisualReviewReceipt } from '../../../application/review';
import { createBlankWorkbenchProject } from '../newProject';
import { useLocalProjectPersistence } from '../persistence/project';
import { createProjectSessionState, projectSessionReducer } from '../state/session';

const createInitialProject = () => ({
  history: createHistoryState(createBlankWorkbenchProject(new Date().toISOString()))
});

export const useWorkbenchProjectSession = () => {
  const [operationLease] = useState(createOperationLease);
  const [initialProject] = useState(createInitialProject);
  const [projectState, dispatchProject] = useReducer(
    projectSessionReducer,
    initialProject,
    ({ history }) => createProjectSessionState(history, {})
  );
  const { history, assets, visualReviews, storage } = projectState;
  const project = history.present;
  const document = project.document;
  const report = useMemo(() => validateProjectDocument(document), [document]);

  const dispatchUserMutation = useCallback((action: HistoryAction): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject(action);
  }, [operationLease]);

  const hydrateProject = useCallback((record: ProjectSnapshot): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject({ type: 'hydrate', record });
  }, [operationLease]);

  const receiveExternalProject = useCallback((record: ProjectSnapshot): void => {
    if (operationLease.currentOwner() !== null) return;
    dispatchProject({ type: 'external', record });
  }, [operationLease]);

  const storageStatus = useLocalProjectPersistence({
    enabled: true,
    projectId: project.id,
    projectGeneration: storage.generation,
    restoreFromStorage: storage.restoreFromStorage,
    project,
    onHydrate: hydrateProject,
    onExternal: receiveExternalProject
  }).status;

  const replaceProject = useCallback((opened: AssetProject): void => {
    dispatchProject({
      type: 'replace',
      record: createProjectSnapshot(opened, new Date().toISOString())
    });
  }, []);

  const recordVisualReview = useCallback((receipt: VisualReviewReceipt): void => {
    dispatchProject({ type: 'visualReview.record', receipt });
  }, []);

  return {
    initialSelectionId: null,
    initialClipId: Object.keys(project.document.animations)[0] ?? null,
    project,
    document,
    history,
    assets,
    visualReviews,
    storage,
    report,
    storageStatus,
    operationLease,
    dispatchProject,
    dispatchUserMutation,
    recordVisualReview,
    replaceProject
  };
};
