export type StorageStatus = 'loading' | 'saving' | 'saved' | 'error';

export interface PersistenceSessionIdentity {
  projectId: string;
  projectGeneration: number;
}

export interface PersistenceSessionState extends PersistenceSessionIdentity {
  authoritative: boolean;
  ready: boolean;
  status: StorageStatus;
  lastSavedAt: string | null;
}

export type PersistenceSessionAction =
  | {
      type: 'begin';
      session: PersistenceSessionIdentity;
      authoritative: boolean;
    }
  | {
      type: 'ready';
      session: PersistenceSessionIdentity;
      lastSavedAt: string | null;
    }
  | {
      type: 'saving';
      session: PersistenceSessionIdentity;
    }
  | {
      type: 'saved';
      session: PersistenceSessionIdentity;
      lastSavedAt: string;
    }
  | {
      type: 'error';
      session: PersistenceSessionIdentity;
      ready?: boolean;
    };

export const createPersistenceSessionState = (
  session: PersistenceSessionIdentity,
  authoritative: boolean
): PersistenceSessionState => ({
  ...session,
  authoritative,
  ready: false,
  status: 'loading',
  lastSavedAt: null
});

export const isPersistenceSession = (
  state: PersistenceSessionIdentity,
  session: PersistenceSessionIdentity
): boolean =>
  state.projectId === session.projectId &&
  state.projectGeneration === session.projectGeneration;

export const persistenceSessionReducer = (
  state: PersistenceSessionState,
  action: PersistenceSessionAction
): PersistenceSessionState => {
  if (action.type === 'begin') {
    return createPersistenceSessionState(
      action.session,
      action.authoritative
    );
  }
  if (!isPersistenceSession(state, action.session)) return state;
  switch (action.type) {
    case 'ready':
      return {
        ...state,
        ready: true,
        status: 'saved',
        lastSavedAt: action.lastSavedAt
      };
    case 'saving':
      return { ...state, status: 'saving' };
    case 'saved':
      return {
        ...state,
        authoritative: false,
        ready: true,
        status: 'saved',
        lastSavedAt: action.lastSavedAt
      };
    case 'error':
      return {
        ...state,
        ready: action.ready ?? state.ready,
        status: 'error'
      };
  }
};
