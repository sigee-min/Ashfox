export type FileOperationKind =
  | 'open'
  | 'drop'
  | 'save'
  | 'export'
  | 'capture';

export type FileOperationState<TResult = never> =
  | {
      phase: 'idle';
      operationId: 0;
      kind: null;
      message: null;
      result: null;
    }
  | {
      phase: 'running' | 'cancelled' | 'failed';
      operationId: number;
      kind: FileOperationKind;
      message: string;
      result: null;
    }
  | {
      phase: 'succeeded';
      operationId: number;
      kind: FileOperationKind;
      message: string;
      result: TResult | null;
    };

export type FileOperationAction<TResult = never> =
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
      result: TResult | null;
    }
  | {
      type: 'progress';
      operationId: number;
      message: string;
    };

export const INITIAL_FILE_OPERATION: FileOperationState = {
  phase: 'idle',
  operationId: 0,
  kind: null,
  message: null,
  result: null
};

export const fileOperationReducer = <TResult>(
  state: FileOperationState<TResult>,
  action: FileOperationAction<TResult>
): FileOperationState<TResult> => {
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
      message: action.message,
      result: null
    };
  }
  if (action.type === 'progress') {
    if (
      state.phase !== 'running' ||
      action.operationId !== state.operationId
    ) {
      return state;
    }
    return {
      ...state,
      message: action.message
    };
  }
  if (
    state.phase !== 'running' ||
    action.operationId !== state.operationId
  ) {
    return state;
  }
  if (action.phase === 'succeeded') {
    return {
      phase: 'succeeded',
      operationId: state.operationId,
      kind: state.kind,
      message: action.message,
      result: action.result
    };
  }
  return {
    phase: action.phase,
    operationId: state.operationId,
    kind: state.kind,
    message: action.message,
    result: null
  };
};
