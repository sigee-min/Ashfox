'use client';

import {
  useCallback,
  type DragEvent
} from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  downloadProjectFile,
  downloadTargetExport,
  openProjectFile,
  parseProjectFile
} from './browserFileWorkflow';
import type { FileOperationState } from './fileOperationState';
import type { AshfoxProjectFile } from './projectArchive';
import type { ProjectAssets } from './projectAssets';
import { useFileOperation } from './useFileOperation';

interface UseProjectFileActionsInput {
  document: ProjectDocument;
  assets: ProjectAssets;
  onLoad: (project: AshfoxProjectFile) => void;
}

interface ProjectFileActions {
  operation: FileOperationState;
  open: () => void;
  drop: (event: DragEvent<HTMLElement>) => void;
  save: () => void;
  exportTarget: (source?: ProjectDocument) => void;
}

export const useProjectFileActions = ({
  document,
  assets,
  onLoad
}: UseProjectFileActionsInput): ProjectFileActions => {
  const {
    state: operation,
    run
  } = useFileOperation();

  const open = useCallback((): void => {
    void run({
      kind: 'open',
      pendingMessage: 'Opening project',
      execute: openProjectFile,
      complete: (project) => {
        if (!project) {
          return {
            phase: 'cancelled',
            message: 'Open cancelled'
          };
        }
        onLoad(project);
        return {
          phase: 'succeeded',
          message: `Opened ${project.document.name}`
        };
      },
      failureMessage: 'Project open failed'
    });
  }, [onLoad, run]);

  const drop = useCallback((event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    void run({
      kind: 'drop',
      pendingMessage: 'Importing dropped project',
      execute: () => parseProjectFile(file),
      complete: (project) => {
        onLoad(project);
        return {
          phase: 'succeeded',
          message: `Opened ${project.document.name}`
        };
      },
      failureMessage: 'Dropped project failed'
    });
  }, [onLoad, run]);

  const save = useCallback((): void => {
    void run({
      kind: 'save',
      pendingMessage: 'Saving project',
      execute: () => downloadProjectFile(document, assets),
      complete: () => ({
        phase: 'succeeded',
        message: `Saved ${document.name}.ashfox`
      }),
      failureMessage: 'Project save failed'
    });
  }, [assets, document, run]);

  const exportTarget = useCallback((source = document): void => {
    void run({
      kind: 'export',
      pendingMessage: 'Building target export',
      execute: () => downloadTargetExport(source, assets),
      complete: (bundle) => ({
        phase: 'succeeded',
        message: `Exported ${bundle.files.length} file${bundle.files.length === 1 ? '' : 's'}`
      }),
      failureMessage: 'Target export failed'
    });
  }, [assets, document, run]);

  return {
    operation,
    open,
    drop,
    save,
    exportTarget
  };
};
