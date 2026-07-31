'use client';

import {
  useCallback,
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
  ProjectArchiveFile
} from '../../files/projectArchive';
import {
  createDemoHistory
} from '../demo/demoFactory';
import {
  resolveDemoDefinition
} from '../demo/demoRegistry';
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

const createInitialProject = () => {
  const search =
    typeof window === 'undefined' ? '' : window.location.search;
  const definition = resolveDemoDefinition(search);
  return {
    definition,
    history: definition
      ? createDemoHistory(definition)
      : createHistoryState(
          createBlankWorkbenchProject(new Date().toISOString())
        ),
    isShowcase: definition !== null
  };
};

export const useWorkbenchProjectSession = () => {
  const [operationLease] = useState(createOperationLease);
  const [initialProject] = useState(createInitialProject);
  const [project, dispatchProject] = useReducer(
    projectSessionReducer,
    initialProject,
    ({ history, isShowcase }) =>
      createProjectSessionState(history, {}, !isShowcase)
  );
  const { history, assets, storage } = project;
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
        savedAt
      })
    });
  }, []);

  return {
    initialSelectionId:
      initialProject.definition?.initialSelectionId ?? null,
    initialClipId:
      Object.keys(initialProject.history.present.animations)[0] ?? null,
    document,
    history,
    assets,
    storage,
    report,
    buildCaptureDocuments,
    storageStatus,
    operationLease,
    dispatchProject,
    dispatchUserMutation,
    replaceProject
  };
};
