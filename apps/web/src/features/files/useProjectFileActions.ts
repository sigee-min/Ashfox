'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type DragEvent
} from 'react';

import type {
  CommandBatch,
  ProjectDocument
} from '@ashfox/engine-core';

import {
  createProjectArtifact,
  createTargetArtifact,
  parseProjectFile
} from './browserFileWorkflow';
import {
  createArtifactPreparationOperations,
  type ArtifactPreparationRequest
} from './artifactPreparation';
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
import type {
  ProjectExportTarget
} from '../../application/projectExportTarget';
import type {
  CommandOutcome
} from '../../application/commandOutcome';
import type {
  HistoryAction
} from '../../application/historyReducer';
import {
  LOCAL_COMMAND_ACTOR_ID
} from '../../application/localCommandActor';

interface UseProjectFileActionsInput {
  document: ProjectDocument;
  assets: ProjectAssets;
  commandOutcome: CommandOutcome | null;
  dispatch: Dispatch<HistoryAction>;
  onLoad: (project: ProjectArchiveFile) => void;
}

interface ProjectFileActions {
  operation: FileOperationState<ArtifactFile>;
  artifactFile: ArtifactFile | null;
  captureFile: GifCaptureFile | null;
  open: (file: File) => void;
  drop: (event: DragEvent<HTMLElement>) => void;
  save: () => void;
  exportTarget: (target: ProjectExportTarget) => void;
  captureGif: (request: GifCaptureRequest) => void;
  cancel: () => void;
}

interface PendingPreparation {
  commandId: string;
  priorCommandId: string | null;
  resolve: (document: ProjectDocument) => void;
  reject: (error: Error) => void;
  detachAbort: () => void;
}

const abortError = (): DOMException =>
  new DOMException('File operation cancelled.', 'AbortError');

export const useProjectFileActions = ({
  document,
  assets,
  commandOutcome,
  dispatch,
  onLoad
}: UseProjectFileActionsInput): ProjectFileActions => {
  const {
    state: operation,
    run,
    cancel
  } = useFileOperation<ArtifactFile>();
  const pendingPreparation = useRef<PendingPreparation | null>(null);

  const settlePreparation = useCallback(
    (
      pending: PendingPreparation,
      result: ProjectDocument | Error
    ): void => {
      if (pendingPreparation.current !== pending) return;
      pendingPreparation.current = null;
      pending.detachAbort();
      if (result instanceof Error) pending.reject(result);
      else pending.resolve(result);
    },
    []
  );

  useEffect(() => {
    const pending = pendingPreparation.current;
    if (!pending || !commandOutcome) return;
    if (commandOutcome.commandId !== pending.commandId) {
      if (commandOutcome.commandId === pending.priorCommandId) return;
      settlePreparation(
        pending,
        new Error(
          'File preparation was superseded by another project command. Retry the operation.'
        )
      );
      return;
    }
    if (commandOutcome.status === 'rejected') {
      settlePreparation(
        pending,
        new Error(commandOutcome.error.message)
      );
      return;
    }
    if (commandOutcome.receipt.revision !== document.revision) {
      settlePreparation(
        pending,
        new Error(
          'Prepared project revision is no longer active. Retry the operation.'
        )
      );
      return;
    }
    settlePreparation(pending, document);
  }, [
    commandOutcome,
    document,
    settlePreparation
  ]);

  useEffect(
    () => () => {
      const pending = pendingPreparation.current;
      if (!pending) return;
      pendingPreparation.current = null;
      pending.detachAbort();
      pending.reject(abortError());
    },
    []
  );

  const prepareArtifactDocument = useCallback(
    (
      request: ArtifactPreparationRequest,
      signal: AbortSignal
    ): Promise<ProjectDocument> => {
      const operations = createArtifactPreparationOperations(
        document,
        request
      );
      if (operations.length === 0) return Promise.resolve(document);
      if (pendingPreparation.current) {
        return Promise.reject(
          new Error('Another file preparation is already running.')
        );
      }
      const batch: CommandBatch = {
        batchId: crypto.randomUUID(),
        baseProjectId: document.id,
        baseRevision: document.revision,
        operations
      };
      return new Promise<ProjectDocument>((resolve, reject) => {
        if (signal.aborted) {
          reject(abortError());
          return;
        }
        const onAbort = (): void => {
          const pending = pendingPreparation.current;
          if (pending?.commandId !== batch.batchId) return;
          settlePreparation(pending, abortError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
        const pending: PendingPreparation = {
          commandId: batch.batchId,
          priorCommandId: commandOutcome?.commandId ?? null,
          resolve,
          reject,
          detachAbort: () =>
            signal.removeEventListener('abort', onAbort)
        };
        pendingPreparation.current = pending;
        try {
          dispatch({
            type: 'execute',
            batch,
            actorId: LOCAL_COMMAND_ACTOR_ID,
            source: 'web',
            committedAt: new Date().toISOString()
          });
        } catch (error: unknown) {
          settlePreparation(
            pending,
            error instanceof Error
              ? error
              : new Error('Project preparation failed.')
          );
        }
      });
    },
    [commandOutcome?.commandId, dispatch, document, settlePreparation]
  );

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
      execute: async ({ signal }) => {
        const source = await prepareArtifactDocument(
          { kind: 'save' },
          signal
        );
        return createProjectArtifact(source, assets);
      },
      complete: (artifact) => ({
        phase: 'succeeded',
        message: `Ready · ${artifact.name}`,
        result: artifact
      }),
      failureMessage: 'Project save failed'
    });
  }, [assets, prepareArtifactDocument, run]);

  const exportTarget = useCallback((target: ProjectExportTarget): void => {
    void run({
      kind: 'export',
      pendingMessage: 'Building target export',
      execute: async ({ signal }) => {
        const source = await prepareArtifactDocument(
          { kind: 'export', target },
          signal
        );
        return createTargetArtifact(source, assets);
      },
      complete: (artifact) => ({
        phase: 'succeeded',
        message: `Ready · ${artifact.name} · ${artifact.sourceFileCount} file${artifact.sourceFileCount === 1 ? '' : 's'}`,
        result: artifact
      }),
      failureMessage: 'Target export failed'
    });
  }, [assets, prepareArtifactDocument, run]);

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
