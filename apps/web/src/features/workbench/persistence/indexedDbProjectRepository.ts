import {
  areLocalProjectRecordsEqual,
  compareProjectRevisions,
  isValidLocalProjectRecord,
  type LocalProjectRecord
} from './localProjectRecord';

const DATABASE_NAME = 'ashfox-workbench';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'project-snapshots';

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed.'))
    );
  });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
    );
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    );
  });

const openProjectDatabase = (): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let settled = false;
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, {
          keyPath: 'projectId'
        });
      }
    });
    request.addEventListener('success', () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    });
    request.addEventListener('blocked', () => {
      if (settled) return;
      settled = true;
      reject(new Error('Local project storage is blocked by another tab.'));
    });
    request.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      reject(
        request.error ?? new Error('Could not open local project storage.')
      );
    });
  });

export const loadLocalProject = async (
  projectId: string
): Promise<LocalProjectRecord | null> => {
  const database = await openProjectDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const result = await requestResult(
      transaction.objectStore(PROJECT_STORE).get(projectId)
    );
    await transactionComplete(transaction);
    const record = result as LocalProjectRecord | undefined;
    return record
      ? {
          ...record,
          assets: record.assets ?? {}
        }
      : null;
  } finally {
    database.close();
  }
};

export const saveLocalProject = async (
  record: LocalProjectRecord
): Promise<SaveLocalProjectResult> => {
  if (!isValidLocalProjectRecord(record, record.projectId)) {
    throw new Error('Refused to persist an invalid local project record.');
  }
  const database = await openProjectDatabase();
  try {
    return await writeNewestProjectRecord(database, record);
  } finally {
    database.close();
  }
};

export type SaveLocalProjectResult =
  | {
      status: 'stored' | 'unchanged';
      current: LocalProjectRecord;
    }
  | {
      status: 'conflict';
      current: LocalProjectRecord;
    }
  | {
      status: 'blocked';
      current: LocalProjectRecord;
    };

const sameProjectSnapshot = (
  left: LocalProjectRecord,
  right: LocalProjectRecord
): boolean => areLocalProjectRecordsEqual(left, right);

export const decideProjectWrite = (
  existing: LocalProjectRecord | undefined,
  candidate: LocalProjectRecord
): SaveLocalProjectResult => {
  if (!existing) {
    return { status: 'stored', current: candidate };
  }
  if (!isValidLocalProjectRecord(existing, candidate.projectId)) {
    return { status: 'blocked', current: existing };
  }

  const revisionOrder = compareProjectRevisions(
    candidate.revision,
    existing.revision
  );
  if (revisionOrder > 0) {
    return { status: 'stored', current: candidate };
  }
  if (
    revisionOrder === 0 &&
    candidate.revision === existing.revision &&
    sameProjectSnapshot(candidate, existing)
  ) {
    return { status: 'unchanged', current: existing };
  }
  return { status: 'conflict', current: existing };
};

const writeNewestProjectRecord = (
  database: IDBDatabase,
  record: LocalProjectRecord
): Promise<SaveLocalProjectResult> =>
  new Promise<SaveLocalProjectResult>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECT_STORE);
    const readRequest = store.get(record.projectId);
    let result: SaveLocalProjectResult | undefined;

    readRequest.addEventListener('success', () => {
      result = decideProjectWrite(
        readRequest.result as LocalProjectRecord | undefined,
        record
      );
      if (result.status === 'stored') store.put(record);
    });
    readRequest.addEventListener('error', () => {
      transaction.abort();
    });
    transaction.addEventListener('complete', () => {
      if (result) resolve(result);
      else reject(new Error('Local project write completed without a result.'));
    });
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
    );
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    );
  });
