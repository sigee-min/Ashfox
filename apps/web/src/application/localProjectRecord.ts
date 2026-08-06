import {
  INTERNAL_CONTRACT_VERSIONS,
  isCurrentInternalContractVersion,
  isValidCommandReceiptLedger,
  parseProjectDocument,
  validateProjectDocument,
  type CommandReceipt,
  type ProjectDocument
} from '@ashfox/engine-core';
import {
  hasExactContractKeys,
  isCanonicalIsoDate,
  isClosedContractRecord
} from '@ashfox/internal-contracts';
import {
  areVisualReviewLedgersEqual,
  isValidVisualReviewLedger,
  type VisualReviewReceipt
} from './visualReviewReceipt';
import {
  areProjectAssetsEqual,
  isProjectAssets,
  type ProjectAssets
} from './projectAssets';

export const LOCAL_PROJECT_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.localProjectRecord;
const LOCAL_PROJECT_ACTIVITY_LIMIT = 100;

export interface LocalProjectRecord {
  schemaVersion: typeof LOCAL_PROJECT_SCHEMA_VERSION;
  projectId: string;
  revision: string;
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  visualReviews: readonly VisualReviewReceipt[];
  savedAt: string;
}

const LOCAL_PROJECT_RECORD_KEYS = new Set([
  'schemaVersion',
  'projectId',
  'revision',
  'document',
  'assets',
  'activity',
  'visualReviews',
  'savedAt'
]);

interface CreateLocalProjectRecordInput {
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  visualReviews: readonly VisualReviewReceipt[];
  savedAt: string;
}

export const createLocalProjectRecord = ({
  document,
  assets,
  activity,
  visualReviews,
  savedAt
}: CreateLocalProjectRecordInput): LocalProjectRecord => ({
  schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
  projectId: document.id,
  revision: document.revision,
  document,
  assets,
  activity,
  visualReviews,
  savedAt
});

export interface ProjectRevisionMessage {
  projectId: string;
  revision: string;
}

const LOCAL_REVISION_PATTERN = /^local-(\d+)$/;

export const isLocalProjectRevision = (revision: string): boolean =>
  LOCAL_REVISION_PATTERN.test(revision);

export const projectRevisionSerial = (revision: string): number => {
  const match = LOCAL_REVISION_PATTERN.exec(revision);
  if (!match) return 1;
  const serial = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(serial) && serial > 0 ? serial : 1;
};

export const localProjectRevisionForSerial = (serial: number): string => {
  const safeSerial = Number.isSafeInteger(serial) && serial > 0 ? serial : 1;
  return `local-${String(safeSerial).padStart(4, '0')}`;
};

export const compareProjectRevisions = (
  left: string,
  right: string
): number => {
  if (left === right) return 0;
  const leftMatch = LOCAL_REVISION_PATTERN.exec(left);
  const rightMatch = LOCAL_REVISION_PATTERN.exec(right);
  if (leftMatch && !rightMatch) return 1;
  if (!leftMatch && rightMatch) return -1;
  if (!leftMatch || !rightMatch) return 0;
  return projectRevisionSerial(left) - projectRevisionSerial(right);
};

const hasClosedRecordShape = (
  record: Readonly<Record<string, unknown>>
): boolean => hasExactContractKeys(record, LOCAL_PROJECT_RECORD_KEYS);

export const isValidLocalProjectRecord = (
  value: unknown,
  projectId: string
): value is LocalProjectRecord => {
  if (!isClosedContractRecord(value) || !hasClosedRecordShape(value)) {
    return false;
  }
  if (
    !isCurrentInternalContractVersion(
      'localProjectRecord',
      value.schemaVersion
    ) ||
    value.projectId !== projectId ||
    typeof value.revision !== 'string' ||
    !isClosedContractRecord(value.document) ||
    value.document.id !== projectId ||
    value.revision !== value.document.revision ||
    !isProjectAssets(value.assets) ||
    !isValidCommandReceiptLedger(value.activity, {
      projectId,
      maxEntries: LOCAL_PROJECT_ACTIVITY_LIMIT
    }) ||
    !isCanonicalIsoDate(value.savedAt)
  ) {
    return false;
  }
  try {
    const document = parseProjectDocument(value.document);
    return validateProjectDocument(document).valid &&
      isValidVisualReviewLedger(value.visualReviews, document);
  } catch {
    return false;
  }
};

export const parseLocalProjectRecord = (
  value: unknown,
  projectId: string
): LocalProjectRecord => {
  if (!isClosedContractRecord(value) || !hasClosedRecordShape(value)) {
    throw new Error('Stored local project does not match the closed v1 schema.');
  }
  const document = parseProjectDocument(value.document);
  const record = {
    schemaVersion: value.schemaVersion,
    projectId: value.projectId,
    revision: value.revision,
    document,
    assets: value.assets,
    activity: value.activity,
    visualReviews: value.visualReviews,
    savedAt: value.savedAt
  };
  if (!isValidLocalProjectRecord(record, projectId)) {
    throw new Error('Stored local project failed closed v1 validation.');
  }
  return record;
};

export const areProjectDocumentsEqual = (
  left: ProjectDocument,
  right: ProjectDocument
): boolean =>
  left === right || JSON.stringify(left) === JSON.stringify(right);

export const areLocalProjectRecordsEqual = (
  left: LocalProjectRecord,
  right: LocalProjectRecord
): boolean =>
  areProjectDocumentsEqual(left.document, right.document) &&
  areProjectAssetsEqual(left.assets, right.assets) &&
  JSON.stringify(left.activity) === JSON.stringify(right.activity) &&
  areVisualReviewLedgersEqual(left.visualReviews, right.visualReviews);

export const areLocalProjectPayloadsEqual = (
  left: LocalProjectRecord,
  right: LocalProjectRecord
): boolean =>
  areProjectDocumentsEqual(left.document, right.document) &&
  areProjectAssetsEqual(left.assets, right.assets) &&
  JSON.stringify(left.activity) === JSON.stringify(right.activity);
