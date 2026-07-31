import type { ProjectAssets } from '../../../application/projectAssets';
import type { LocalProjectRecord } from '../../../application/localProjectRecord';
import {
  historyReducer,
  type HistoryAction,
  type HistoryState
} from '../../../application/historyReducer';

export interface ProjectStorageSession {
  generation: number;
  restoreFromStorage: boolean;
}

export interface ProjectSessionState {
  history: HistoryState;
  assets: ProjectAssets;
  storage: ProjectStorageSession;
}

export type ProjectSessionAction =
  | HistoryAction
  | {
      type: 'replace';
      record: LocalProjectRecord;
    };

export const createProjectSessionState = (
  history: HistoryState,
  assets: ProjectAssets = {},
  restoreFromStorage = true
): ProjectSessionState => ({
  history,
  assets,
  storage: {
    generation: 0,
    restoreFromStorage
  }
});

const applyProjectRecord = (
  state: ProjectSessionState,
  action: Extract<HistoryAction, { type: 'hydrate' | 'external' }>
): ProjectSessionState => {
  const history = historyReducer(state.history, action);
  if (history === state.history) return state;
  return {
    ...state,
    history,
    assets: action.record.assets
  };
};

export const projectSessionReducer = (
  state: ProjectSessionState,
  action: ProjectSessionAction
): ProjectSessionState => {
  if (action.type === 'replace') {
    return {
      history: historyReducer(state.history, {
        type: 'hydrate',
        record: action.record
      }),
      assets: action.record.assets,
      storage: {
        generation: state.storage.generation + 1,
        restoreFromStorage: false
      }
    };
  }
  if (action.type === 'hydrate' || action.type === 'external') {
    return applyProjectRecord(state, action);
  }
  const history = historyReducer(state.history, action);
  if (history === state.history) return state;
  if (history.present.id !== state.history.present.id) {
    return {
      history,
      assets: {},
      storage: {
        generation: state.storage.generation + 1,
        restoreFromStorage: false
      }
    };
  }
  return { ...state, history };
};
