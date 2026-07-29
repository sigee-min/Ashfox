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

interface FileOperationCompletion {
  phase: 'succeeded' | 'cancelled';
  message: string;
}

interface FileOperationSpec<T> {
  kind: FileOperationKind;
  pendingMessage: string;
  execute: () => T | Promise<T>;
  complete: (value: T) => FileOperationCompletion;
  failureMessage: string;
}

interface FileOperationController {
  state: FileOperationState;
  run: <T>(spec: FileOperationSpec<T>) => Promise<void>;
}

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useFileOperation = (): FileOperationController => {
  const [state, dispatch] = useReducer(
    fileOperationReducer,
    INITIAL_FILE_OPERATION
  );
  const serialRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);

  const run = useCallback(
    async <T,>(spec: FileOperationSpec<T>): Promise<void> => {
      if (activeIdRef.current !== null) return;
      const operationId = serialRef.current + 1;
      serialRef.current = operationId;
      activeIdRef.current = operationId;
      dispatch({
        type: 'start',
        operationId,
        kind: spec.kind,
        message: spec.pendingMessage
      });
      try {
        const value = await spec.execute();
        const completion = spec.complete(value);
        dispatch({
          type: 'settle',
          operationId,
          phase: completion.phase,
          message: completion.message
        });
      } catch (error: unknown) {
        dispatch({
          type: 'settle',
          operationId,
          phase: 'failed',
          message: errorMessage(error, spec.failureMessage)
        });
      } finally {
        if (activeIdRef.current === operationId) {
          activeIdRef.current = null;
        }
      }
    },
    []
  );

  return { state, run };
};
