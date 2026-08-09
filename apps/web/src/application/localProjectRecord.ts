import {
  INTERNAL_CONTRACT_VERSIONS,
  INTENT_PROGRAM_SOURCE_MAX_LENGTH,
  isCurrentInternalContractVersion
} from '@ashfox/engine-core';
import {
  hasExactContractKeys,
  isCanonicalIsoDate,
  isClosedContractRecord,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

export const LOCAL_PROJECT_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.localProjectRecord;

/**
 * Durable browser authority. Compiled ProjectDocument output is deliberately
 * absent and must be reconstructed atomically from `source` on every restore.
 */
export interface LocalProjectRecord {
  readonly schemaVersion: typeof LOCAL_PROJECT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly revision: string;
  readonly createdAt: string;
  readonly source: string;
  readonly savedAt: string;
}

const LOCAL_PROJECT_RECORD_KEYS = new Set([
  'schemaVersion',
  'projectId',
  'revision',
  'createdAt',
  'source',
  'savedAt'
]);

export interface CreateLocalProjectRecordInput {
  readonly projectId: string;
  readonly revision: string;
  readonly createdAt: string;
  readonly source: string;
  readonly savedAt: string;
}

export const createLocalProjectRecord = ({
  projectId,
  revision,
  createdAt,
  source,
  savedAt
}: CreateLocalProjectRecordInput): LocalProjectRecord => ({
  schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
  projectId,
  revision,
  createdAt,
  source,
  savedAt
});

export interface ProjectRevisionMessage {
  readonly projectId: string;
  readonly revision: string;
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

export const isValidLocalProjectRecord = (
  value: unknown,
  projectId: string
): value is LocalProjectRecord =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, LOCAL_PROJECT_RECORD_KEYS) &&
  isCurrentInternalContractVersion(
    'localProjectRecord',
    value.schemaVersion
  ) &&
  isNonEmptyContractText(value.projectId) &&
  value.projectId === projectId &&
  isNonEmptyContractText(value.revision) &&
  isCanonicalIsoDate(value.createdAt) &&
  typeof value.source === 'string' &&
  value.source.length > 0 &&
  value.source.length <= INTENT_PROGRAM_SOURCE_MAX_LENGTH &&
  isCanonicalIsoDate(value.savedAt);

export const parseLocalProjectRecord = (
  value: unknown,
  projectId: string
): LocalProjectRecord => {
  if (!isValidLocalProjectRecord(value, projectId)) {
    throw new Error('Stored local source failed the closed v1 contract.');
  }
  return {
    schemaVersion: value.schemaVersion,
    projectId: value.projectId,
    revision: value.revision,
    createdAt: value.createdAt,
    source: value.source,
    savedAt: value.savedAt
  };
};

export const areLocalProjectRecordsEqual = (
  left: LocalProjectRecord,
  right: LocalProjectRecord
): boolean =>
  left.projectId === right.projectId &&
  left.revision === right.revision &&
  left.createdAt === right.createdAt &&
  left.source === right.source;
