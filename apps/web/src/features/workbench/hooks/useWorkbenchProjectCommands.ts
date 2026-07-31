'use client';

import { useCallback, type Dispatch } from 'react';

import {
  type ProjectDocument,
  type ProjectCommandOperation,
  type Transform,
  type Vec3
} from '@ashfox/engine-core';

import {
  createProjectOperation,
  type NewProjectInput
} from '../newProject';
import {
  createProjectSettingsOperations,
  type ProjectSettingsInput
} from '../projectSettings';
import type { HistoryAction } from '../../../application/historyReducer';
import { LOCAL_COMMAND_ACTOR_ID } from '../../../application/localCommandActor';

interface UseWorkbenchProjectCommandsInput {
  document: ProjectDocument;
  selectedNodeId: string | null;
  dispatch: Dispatch<HistoryAction>;
}

interface WorkbenchProjectCommands {
  createProject: (input: NewProjectInput) => void;
  updateProjectSettings: (input: ProjectSettingsInput) => void;
  commitNodeTransform: (nodeId: string, transform: Transform) => void;
  updateTransformProperty: (
    property: keyof Transform,
    value: Vec3
  ) => void;
  toggleVisibility: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useWorkbenchProjectCommands = ({
  document,
  selectedNodeId,
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

  const commitNodeTransform = useCallback(
    (nodeId: string, transform: Transform): void => {
      if (document.scene.nodes[nodeId]?.generation) return;
      execute([{
        name: 'scene.nodes.transform',
        payload: {
          nodeIds: [nodeId],
          transform
        }
      }]);
    },
    [document.scene.nodes, execute]
  );

  const updateTransformProperty = useCallback(
    (property: keyof Transform, value: Vec3): void => {
      if (!selectedNodeId) return;
      if (document.scene.nodes[selectedNodeId]?.generation) return;
      execute([{
        name: 'scene.nodes.transform',
        payload: {
          nodeIds: [selectedNodeId],
          transform: {
            [property]: value
          }
        }
      }]);
    },
    [document.scene.nodes, execute, selectedNodeId]
  );

  const toggleVisibility = useCallback(
    (nodeId: string): void => {
      const node = document.scene.nodes[nodeId];
      if (!node || node.generation) return;
      execute([{
        name: 'scene.nodes.visibility',
        payload: {
          nodeIds: [nodeId],
          visible: !node.visible
        }
      }]);
    },
    [document.scene.nodes, execute]
  );

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
    commitNodeTransform,
    updateTransformProperty,
    toggleVisibility,
    undo,
    redo
  };
};
