'use client';

import { useCallback, type Dispatch } from 'react';

import {
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createProjectOperation,
  type NewProjectInput
} from '../newProject';
import type { HistoryAction } from '../../../application/historyReducer';
import { LOCAL_COMMAND_ACTOR_ID } from '../../../application/localCommandActor';

interface UseWorkbenchProjectCommandsInput {
  document: ProjectDocument;
  dispatch: Dispatch<HistoryAction>;
}

interface WorkbenchProjectCommands {
  createProject: (input: NewProjectInput) => void;
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

  const createProject = useCallback(
    (input: NewProjectInput): void => {
      execute([
        createProjectOperation(input)
      ]);
    },
    [execute]
  );

  return {
    createProject
  };
};
