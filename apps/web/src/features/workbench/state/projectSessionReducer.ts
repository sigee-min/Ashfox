import type { ProjectAssets } from '../../../application/projectAssets';
import type { LocalProjectRecord } from '../../../application/localProjectRecord';
import {
  areVisualReviewLedgersEqual,
  isValidVisualReviewReceipt,
  mergeVisualReviewLedgers,
  recordVisualReview,
  type VisualReviewReceipt
} from '../../../application/visualReviewReceipt';
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
  visualReviews: readonly VisualReviewReceipt[];
  storage: ProjectStorageSession;
}

export type ProjectSessionAction =
  | HistoryAction
  | {
      type: 'replace';
      record: LocalProjectRecord;
    }
  | {
      type: 'visualReview.record';
      receipt: VisualReviewReceipt;
    };

export const createProjectSessionState = (
  history: HistoryState,
  assets: ProjectAssets = {},
  restoreFromStorage = true,
  visualReviews: readonly VisualReviewReceipt[] = []
): ProjectSessionState => ({
  history,
  assets,
  visualReviews,
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
  if (action.type === 'external' && history === state.history) {
    if (
      action.record.projectId !== state.history.present.id ||
      action.record.revision !== state.history.present.revision
    ) {
      return state;
    }
    const visualReviews = mergeVisualReviewLedgers(
      state.visualReviews,
      action.record.visualReviews
    );
    return areVisualReviewLedgersEqual(
      state.visualReviews,
      visualReviews
    )
      ? state
      : { ...state, visualReviews };
  }
  const recordMatchesHistory =
    action.record.projectId === history.present.id &&
    action.record.revision === history.present.revision;
  const visualReviews = recordMatchesHistory
    ? action.record.visualReviews
    : [];
  if (history === state.history &&
    state.assets === action.record.assets &&
    areVisualReviewLedgersEqual(state.visualReviews, visualReviews)) {
    return state;
  }
  return {
    ...state,
    history,
    assets: action.record.assets,
    visualReviews
  };
};

export const projectSessionReducer = (
  state: ProjectSessionState,
  action: ProjectSessionAction
): ProjectSessionState => {
  if (action.type === 'visualReview.record') {
    if (
      action.receipt.projectId !== state.history.present.id ||
      action.receipt.revision !== state.history.present.revision ||
      !isValidVisualReviewReceipt(
        action.receipt,
        state.history.present
      )
    ) {
      return state;
    }
    const visualReviews = recordVisualReview(
      state.visualReviews,
      action.receipt
    );
    return areVisualReviewLedgersEqual(
      state.visualReviews,
      visualReviews
    )
      ? state
      : { ...state, visualReviews };
  }
  if (action.type === 'replace') {
    const history = historyReducer(state.history, {
      type: 'hydrate',
      record: action.record
    });
    return {
      history,
      assets: action.record.assets,
      visualReviews:
        history.present.id === action.record.projectId &&
        history.present.revision === action.record.revision
          ? action.record.visualReviews
          : [],
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
      visualReviews: [],
      storage: {
        generation: state.storage.generation + 1,
        restoreFromStorage: false
      }
    };
  }
  return {
    ...state,
    history,
    visualReviews:
      history.present.revision === state.history.present.revision
        ? state.visualReviews
        : []
  };
};
