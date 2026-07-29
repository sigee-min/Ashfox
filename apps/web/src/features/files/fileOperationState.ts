export type FileOperationKind = 'open' | 'drop' | 'save' | 'export';

export type FileOperationState =
  | {
      phase: 'idle';
      operationId: 0;
      kind: null;
      message: null;
    }
  | {
      phase: 'running' | 'succeeded' | 'cancelled' | 'failed';
      operationId: number;
      kind: FileOperationKind;
      message: string;
    };

export type FileOperationAction =
  | {
      type: 'start';
      operationId: number;
      kind: FileOperationKind;
      message: string;
    }
  | {
      type: 'settle';
      operationId: number;
      phase: 'succeeded' | 'cancelled' | 'failed';
      message: string;
    };

export const INITIAL_FILE_OPERATION: FileOperationState = {
  phase: 'idle',
  operationId: 0,
  kind: null,
  message: null
};

export const fileOperationReducer = (
  state: FileOperationState,
  action: FileOperationAction
): FileOperationState => {
  if (action.type === 'start') {
    if (
      state.phase === 'running' ||
      action.operationId <= state.operationId
    ) {
      return state;
    }
    return {
      phase: 'running',
      operationId: action.operationId,
      kind: action.kind,
      message: action.message
    };
  }
  if (
    state.phase !== 'running' ||
    action.operationId !== state.operationId
  ) {
    return state;
  }
  return {
    phase: action.phase,
    operationId: state.operationId,
    kind: state.kind,
    message: action.message
  };
};
