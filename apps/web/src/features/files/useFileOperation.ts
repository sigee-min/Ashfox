'use client';

import {
  useCallback,
  useReducer,
  useRef
} from 'react';

import {
  fileOperationReducer,
  INITIAL_FILE_OPERATION,
  type FileOperationKind,
  type FileOperationState
} from './fileOperationState';

interface FileOperationCompletion<TResult> {
  phase: 'succeeded' | 'cancelled';
  message: string;
  result?: TResult | null;
}

export interface FileOperationContext {
  signal: AbortSignal;
  reportProgress: (message: string) => void;
}

interface FileOperationSpec<T, TResult> {
  kind: FileOperationKind;
  pendingMessage: string;
  execute: (context: FileOperationContext) => T | Promise<T>;
  complete: (value: T) => FileOperationCompletion<TResult>;
  failureMessage: string;
  cancelledMessage?: string;
}

interface FileOperationController<TResult> {
  state: FileOperationState<TResult>;
  run: <T>(spec: FileOperationSpec<T, TResult>) => Promise<void>;
  cancel: () => void;
}

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useFileOperation = <TResult>(): FileOperationController<TResult> => {
  const [state, dispatch] = useReducer(
    fileOperationReducer<TResult>,
    INITIAL_FILE_OPERATION
  );
  const serialRef = useRef(0);
  const activeRef = useRef<{
    operationId: number;
    controller: AbortController;
    cancelledMessage: string;
  } | null>(null);

  const run = useCallback(
    async <T,>(spec: FileOperationSpec<T, TResult>): Promise<void> => {
      if (activeRef.current !== null) return;
      const operationId = serialRef.current + 1;
      serialRef.current = operationId;
      const controller = new AbortController();
      activeRef.current = {
        operationId,
        controller,
        cancelledMessage:
          spec.cancelledMessage ?? 'Operation cancelled'
      };
      dispatch({
        type: 'start',
        operationId,
        kind: spec.kind,
        message: spec.pendingMessage
      });
      try {
        const value = await spec.execute({
          signal: controller.signal,
          reportProgress: (message) => {
            dispatch({ type: 'progress', operationId, message });
          }
        });
        if (controller.signal.aborted) {
          throw new DOMException(
            'Operation cancelled.',
            'AbortError'
          );
        }
        const completion = spec.complete(value);
        dispatch({
          type: 'settle',
          operationId,
          phase: completion.phase,
          message: completion.message,
          result: completion.result ?? null
        });
      } catch (error: unknown) {
        const cancelled =
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError');
        dispatch({
          type: 'settle',
          operationId,
          phase: cancelled ? 'cancelled' : 'failed',
          message: cancelled
            ? spec.cancelledMessage ?? 'Operation cancelled'
            : errorMessage(error, spec.failureMessage),
          result: null
        });
      } finally {
        if (activeRef.current?.operationId === operationId) {
          activeRef.current = null;
        }
      }
    },
    []
  );

  const cancel = useCallback((): void => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    active.controller.abort();
    dispatch({
      type: 'settle',
      operationId: active.operationId,
      phase: 'cancelled',
      message: active.cancelledMessage,
      result: null
    });
  }, []);

  return { state, run, cancel };
};
