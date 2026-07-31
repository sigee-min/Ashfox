'use client';

import {
  useCallback,
  type DragEvent
} from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  createProjectArtifact,
  createTargetArtifact,
  parseProjectFile
} from './browserFileWorkflow';
import {
  isArtifactCurrent,
  type ArtifactFile
} from './artifactFile';
import type { FileOperationState } from './fileOperationState';
import type { ProjectArchiveFile } from './projectArchive';
import type { ProjectAssets } from '../../application/projectAssets';
import { useFileOperation } from './useFileOperation';
import { createAnimatedGif } from '../capture/createAnimatedGif';
import { createBuildGif } from '../capture/createBuildGif';
import {
  isGifCaptureFile,
  type GifCaptureFile
} from '../capture/gifCaptureFile';
import type { GifCaptureRequest } from '../capture/gifCaptureRequest';
import {
  projectExportTargetFor
} from '../../application/projectExportTarget';

interface UseProjectFileActionsInput {
  document: ProjectDocument;
  assets: ProjectAssets;
  onLoad: (project: ProjectArchiveFile) => void;
}

interface ProjectFileActions {
  operation: FileOperationState<ArtifactFile>;
  artifactFile: ArtifactFile | null;
  captureFile: GifCaptureFile | null;
  open: (file: File) => void;
  drop: (event: DragEvent<HTMLElement>) => void;
  save: () => void;
  exportTarget: () => void;
  captureGif: (request: GifCaptureRequest) => void;
  cancel: () => void;
}

export const useProjectFileActions = ({
  document,
  assets,
  onLoad
}: UseProjectFileActionsInput): ProjectFileActions => {
  const {
    state: operation,
    run,
    cancel
  } = useFileOperation<ArtifactFile>();

  const open = useCallback((file: File): void => {
    void run({
      kind: 'open',
      pendingMessage: 'Opening project',
      execute: () => parseProjectFile(file),
      complete: (project) => {
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
      pendingMessage: 'Preparing project file',
      execute: () => createProjectArtifact(document, assets),
      complete: (artifact) => ({
        phase: 'succeeded',
        message: `Ready · ${artifact.name}`,
        result: artifact
      }),
      failureMessage: 'Project save failed'
    });
  }, [assets, document, run]);

  const exportTarget = useCallback((): void => {
    const target = projectExportTargetFor(document);
    void run({
      kind: 'export',
      pendingMessage: `Building ${target.target} export`,
      execute: () => createTargetArtifact(document, assets),
      complete: (artifact) => ({
        phase: 'succeeded',
        message: `Ready · ${artifact.name} · ${artifact.sourceFileCount} file${artifact.sourceFileCount === 1 ? '' : 's'}`,
        result: artifact
      }),
      failureMessage: 'Target export failed'
    });
  }, [assets, document, run]);

  const captureGif = useCallback(
    (request: GifCaptureRequest): void => {
      void run({
        kind: 'capture',
        pendingMessage:
          request.kind === 'build'
            ? 'Preparing build process GIF'
            : 'Preparing animation GIF',
        execute: ({ signal, reportProgress }) =>
          request.kind === 'build'
            ? createBuildGif(assets, request, {
                signal,
                onProgress: (completed, total) => {
                  reportProgress(`Captured ${completed}/${total} frames`);
                }
              })
            : createAnimatedGif(document, assets, request, {
                signal,
                onProgress: (completed, total) => {
                  reportProgress(`Captured ${completed}/${total} frames`);
                }
              }),
        complete: (capture) => ({
          phase: 'succeeded',
          message: 'GIF ready',
          result: capture
        }),
        failureMessage: 'GIF capture failed',
        cancelledMessage: 'GIF capture cancelled'
      });
    },
    [assets, document, run]
  );

  const artifactFile =
    operation.phase === 'succeeded' &&
    operation.result !== null &&
    isArtifactCurrent(document, operation.result)
      ? operation.result
      : null;

  return {
    operation,
    artifactFile,
    captureFile:
      operation.kind === 'capture' &&
      isGifCaptureFile(artifactFile)
        ? artifactFile
        : null,
    open,
    drop,
    save,
    exportTarget,
    captureGif,
    cancel
  };
};
