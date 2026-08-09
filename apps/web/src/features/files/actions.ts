'use client';

import {
  useCallback,
  type DragEvent
} from 'react';

import type {
  ExportAdapterInput,
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  OperationLease,
  OperationLeaseToken
} from '../../application/operationLease';
import {
  createTargetArtifact,
  type TargetArtifactFile
} from './browserFileWorkflow';
import {
  createProjectArtifact,
  parseProjectFile
} from './source';
import {
  isArtifactCurrent,
  type ArtifactFile
} from './artifactFile';
import type { FileOperationState } from './fileOperationState';
import type { ProjectAssets } from '../../application/projectAssets';
import {
  useFileOperation,
  type FileOperationRunResult
} from './useFileOperation';
import { createAnimatedGif } from '../capture/createAnimatedGif';
import { createBuildGif } from '../capture/createBuildGif';
import { createResultPng } from '../capture/createResultPng';
import {
  isGifCaptureFile,
  type GifCaptureFile
} from '../capture/gifCaptureFile';
import type { GifCaptureRequest } from '../capture/gifCaptureRequest';
import type {
  CaptureArtifactRequest
} from './capture';

interface UseProjectFileActionsInput {
  document: ProjectDocument;
  assets: ProjectAssets;
  onLoad: (document: ProjectDocument) => void;
  operationLease: OperationLease;
}

interface ProjectFileActions {
  operation: FileOperationState<ArtifactFile>;
  artifactFile: ArtifactFile | null;
  captureFile: GifCaptureFile | null;
  open: (file: File) => void;
  drop: (event: DragEvent<HTMLElement>) => void;
  save: () => void;
  exportTarget: (
    adapter: ExportAdapterInput,
    lease?: OperationLeaseToken
  ) => Promise<FileOperationRunResult<TargetArtifactFile>>;
  capture: (
    request: CaptureArtifactRequest,
    lease?: OperationLeaseToken
  ) => Promise<FileOperationRunResult<ArtifactFile>>;
  captureGif: (request: GifCaptureRequest) => void;
  cancel: () => void;
}

const adaptationNotice = (
  artifact: TargetArtifactFile
): string => {
  if (artifact.adaptationCount === 0) return '';
  const converted = artifact.adaptations.converted.length;
  const omitted = artifact.adaptations.omitted.length;
  return [
    converted === 0 ? null : `${converted} converted`,
    omitted === 0 ? null : `${omitted} omitted`
  ].filter((part): part is string => part !== null).join(' · ');
};

export const useProjectFileActions = ({
  document,
  assets,
  onLoad,
  operationLease
}: UseProjectFileActionsInput): ProjectFileActions => {
  const {
    state: operation,
    run,
    cancel
  } = useFileOperation<ArtifactFile>(operationLease);

  const open = useCallback((file: File): void => {
    void run({
      kind: 'open',
      pendingMessage: 'Compiling Intent Program',
      execute: () => parseProjectFile(file),
      complete: (opened) => {
        onLoad(opened);
        return {
          phase: 'succeeded',
          message: `Opened ${opened.name}`
        };
      },
      failureMessage: 'Intent Program open failed'
    });
  }, [onLoad, run]);

  const drop = useCallback((event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    void run({
      kind: 'drop',
      pendingMessage: 'Compiling dropped Intent Program',
      execute: () => parseProjectFile(file),
      complete: (opened) => {
        onLoad(opened);
        return {
          phase: 'succeeded',
          message: `Opened ${opened.name}`
        };
      },
      failureMessage: 'Dropped Intent Program failed'
    });
  }, [onLoad, run]);

  const save = useCallback((): void => {
    void run({
      kind: 'save',
      pendingMessage: 'Preparing Intent Program source',
      execute: () => createProjectArtifact(document),
      complete: (artifact) => ({
        phase: 'succeeded',
        message: `Ready · ${artifact.name}`,
        result: artifact
      }),
      failureMessage: 'Source download failed'
    });
  }, [document, run]);

  const exportTarget = useCallback((
    adapter: ExportAdapterInput,
    lease?: OperationLeaseToken
  ) => {
    return run<TargetArtifactFile, TargetArtifactFile>({
      kind: 'export',
      pendingMessage: `Building ${adapter.target} export`,
      execute: () => createTargetArtifact(document, assets, adapter),
      complete: (artifact) => {
        const adaptations = adaptationNotice(artifact);
        return {
          phase: 'succeeded',
          message:
            `Ready · ${artifact.name} · ${artifact.sourceFileCount} file${artifact.sourceFileCount === 1 ? '' : 's'}` +
            (adaptations.length === 0 ? '' : ` · ${adaptations}`),
          result: artifact
        };
      },
      failureMessage: 'Target export failed'
    }, lease);
  }, [assets, document, run]);

  const capture = useCallback(
    (
      request: CaptureArtifactRequest,
      lease?: OperationLeaseToken
    ): Promise<FileOperationRunResult<ArtifactFile>> =>
      run<ArtifactFile>({
        kind: 'capture',
        pendingMessage:
          request.kind === 'build'
            ? 'Preparing build process GIF'
            : request.kind === 'animation'
              ? 'Preparing animation GIF'
              : 'Preparing result image',
        execute: ({ signal, reportProgress }) =>
          request.kind === 'build'
            ? createBuildGif(assets, request, {
                signal,
                onProgress: (completed, total) => {
                  reportProgress(`Captured ${completed}/${total} frames`);
                }
              })
            : request.kind === 'animation'
              ? createAnimatedGif(document, assets, request, {
                  signal,
                  onProgress: (completed, total) => {
                    reportProgress(`Captured ${completed}/${total} frames`);
                  }
                })
              : createResultPng(document, assets, { signal }),
        complete: (capture) => ({
          phase: 'succeeded',
          message:
            request.kind === 'result' ? 'Image ready' : 'GIF ready',
          result: capture
        }),
        failureMessage:
          request.kind === 'result'
            ? 'Result capture failed'
            : 'GIF capture failed',
        cancelledMessage: 'Capture cancelled'
      }, lease),
    [assets, document, run]
  );

  const captureGif = useCallback(
    (request: GifCaptureRequest): void => {
      void capture(request);
    },
    [capture]
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
    capture,
    captureGif,
    cancel
  };
};
