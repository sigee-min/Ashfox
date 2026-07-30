'use client';

import { useCallback, type Dispatch } from 'react';

import {
  type ProjectDocument,
  type ProjectCommandOperation,
  type Transform,
  type Vec3
} from '@ashfox/engine-core';

import {
  createTextureSyncOperation
} from '../../textures/textureSyncCommand';
import {
  createProjectOperation,
  type NewProjectInput
} from '../newProject';
import {
  type ProjectExportTarget
} from '../presentation/projectExportTarget';
import {
  createProjectSettingsOperations,
  type ProjectSettingsInput
} from '../projectSettings';
import type { HistoryAction } from '../state/historyReducer';
import { LOCAL_COMMAND_ACTOR_ID } from '../state/localCommandActor';

interface UseWorkbenchProjectCommandsInput {
  document: ProjectDocument;
  historySerial: number;
  selectedNodeId: string | null;
  dispatch: Dispatch<HistoryAction>;
  onSelectNode: (nodeId: string | null) => void;
  exportTargetFile: (target: ProjectExportTarget) => void;
}

interface WorkbenchProjectCommands {
  createProject: (input: NewProjectInput) => void;
  updateProjectSettings: (input: ProjectSettingsInput) => void;
  generateMinecraftTexture: () => void;
  exportProject: (target: ProjectExportTarget) => void;
  commitNodeTransform: (nodeId: string, transform: Transform) => void;
  updateTransformProperty: (
    property: keyof Transform,
    value: Vec3
  ) => void;
  toggleVisibility: (nodeId: string) => void;
  addCube: () => void;
  undo: () => void;
  redo: () => void;
}

export const useWorkbenchProjectCommands = ({
  document,
  historySerial,
  selectedNodeId,
  dispatch,
  onSelectNode,
  exportTargetFile
}: UseWorkbenchProjectCommandsInput): WorkbenchProjectCommands => {
  const execute = useCallback(
    (operations: readonly ProjectCommandOperation[]): void => {
      dispatch({
        type: 'execute',
        batch: {
          batchId: crypto.randomUUID(),
          baseRevision: document.revision,
          operations
        },
        actorId: LOCAL_COMMAND_ACTOR_ID,
        source: 'web',
        committedAt: new Date().toISOString()
      });
    },
    [dispatch, document.revision]
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
        createProjectOperation(input, {
          id: `project-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString()
        })
      ]);
    },
    [execute]
  );

  const generateMinecraftTexture = useCallback((): void => {
    const operation = createTextureSyncOperation(document);
    if (operation) execute([operation]);
  }, [document, execute]);

  const exportProject = useCallback(
    (target: ProjectExportTarget): void => {
      exportTargetFile(target);
    },
    [exportTargetFile]
  );

  const commitNodeTransform = useCallback(
    (nodeId: string, transform: Transform): void => {
      execute([{
        name: 'scene.nodes.transform',
        payload: {
          nodeIds: [nodeId],
          transform
        }
      }]);
    },
    [execute]
  );

  const updateTransformProperty = useCallback(
    (property: keyof Transform, value: Vec3): void => {
      if (!selectedNodeId) return;
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
    [execute, selectedNodeId]
  );

  const toggleVisibility = useCallback(
    (nodeId: string): void => {
      const node = document.scene.nodes[nodeId];
      if (!node) return;
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

  const addCube = useCallback((): void => {
    const serial = historySerial + 1;
    const id = `cube-new-${serial}`;
    const selectedNode = selectedNodeId
      ? document.scene.nodes[selectedNodeId]
      : undefined;
    const parentId = selectedNode?.kind === 'bone'
      ? selectedNode.id
      : selectedNode?.parentId ?? document.scene.roots[0] ?? null;
    execute([{
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id,
          name: `Cube ${serial}`,
          parentId,
          bounds: {
            from: [-2, 1, -2],
            to: [2, 5, 2]
          },
          transform: {
            pivot: [0, 3, 0]
          }
        }]
      }
    }]);
    onSelectNode(id);
  }, [
    document.scene.nodes,
    document.scene.roots,
    execute,
    historySerial,
    onSelectNode,
    selectedNodeId
  ]);

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
    generateMinecraftTexture,
    exportProject,
    commitNodeTransform,
    updateTransformProperty,
    toggleVisibility,
    addCube,
    undo,
    redo
  };
};
