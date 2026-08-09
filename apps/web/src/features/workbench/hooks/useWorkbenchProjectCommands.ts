'use client';

import { useCallback, type Dispatch } from 'react';

import {
  type ProjectDocument,
  type ProjectCommandOperation
} from '@ashfox/engine-core';

import {
  createProjectOperation,
  type NewProjectInput
} from '../newProject';
import {
  createProjectSettingsOperations,
  type ProjectSettingsInput
} from '../projectSettings';
import {
  createIntentProgramCompilationAction
} from '../intentProposalConfirmation';
import type { HistoryAction } from '../../../application/historyReducer';
import { LOCAL_COMMAND_ACTOR_ID } from '../../../application/localCommandActor';

interface UseWorkbenchProjectCommandsInput {
  document: ProjectDocument;
  dispatch: Dispatch<HistoryAction>;
}

interface WorkbenchProjectCommands {
  createProject: (input: NewProjectInput) => void;
  updateProjectSettings: (input: ProjectSettingsInput) => void;
  compileIntentProgram: () => void;
  undo: () => void;
  redo: () => void;
}

export const useWorkbenchProjectCommands = ({
  document,
  dispatch
}: UseWorkbenchProjectCommandsInput): WorkbenchProjectCommands => {
  const execute = useCallback(
    (operations: readonly ProjectCommandOperation[]): void => {
      dispatch({
        type: 'execute',
        batch: {
          batchId: crypto.randomUUID(),
          baseProjectId: document.id,
          baseRevision: document.revision,
          operations
        },
        actorId: LOCAL_COMMAND_ACTOR_ID,
        source: 'web',
        committedAt: new Date().toISOString()
      });
    },
    [dispatch, document.id, document.revision]
  );

  const updateProjectSettings = useCallback(
    (input: ProjectSettingsInput): void => {
      const operations =
        createProjectSettingsOperations(document, input);
      if (operations.length > 0) execute(operations);
    },
    [document, execute]
  );

  const createProject = useCallback(
    (input: NewProjectInput): void => {
      execute([
        createProjectOperation(input)
      ]);
    },
    [execute]
  );

  const compileIntentProgram = useCallback((): void => {
    const action = createIntentProgramCompilationAction(
      document,
      crypto.randomUUID(),
      new Date().toISOString()
    );
    if (action) dispatch(action);
  }, [dispatch, document]);

  const undo = useCallback((): void => {
    dispatch({
      type: 'undo',
      commandId: crypto.randomUUID(),
      committedAt: new Date().toISOString()
    });
  }, [dispatch]);

  const redo = useCallback((): void => {
    dispatch({
      type: 'redo',
      commandId: crypto.randomUUID(),
      committedAt: new Date().toISOString()
    });
  }, [dispatch]);

  return {
    createProject,
    updateProjectSettings,
    compileIntentProgram,
    undo,
    redo
  };
};
