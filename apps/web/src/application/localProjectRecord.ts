import {
  validateProjectDocument,
  type CommandReceipt,
  type ProjectDocument
} from '@ashfox/engine-core';
import {
  areProjectAssetsEqual,
  isProjectAssets,
  type ProjectAssets
} from './projectAssets';

export const LOCAL_PROJECT_SCHEMA_VERSION = 3;

export interface LocalProjectRecord {
  schemaVersion: typeof LOCAL_PROJECT_SCHEMA_VERSION;
  projectId: string;
  revision: string;
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  savedAt: string;
}

interface CreateLocalProjectRecordInput {
  document: ProjectDocument;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  savedAt: string;
}

export const createLocalProjectRecord = ({
  document,
  assets,
  activity,
  savedAt
}: CreateLocalProjectRecordInput): LocalProjectRecord => ({
  schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
  projectId: document.id,
  revision: document.revision,
  document,
  assets,
  activity,
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

export const isValidLocalProjectRecord = (
  record: LocalProjectRecord,
  projectId: string
): boolean =>
  record.schemaVersion === LOCAL_PROJECT_SCHEMA_VERSION &&
  record.projectId === projectId &&
  record.document.id === projectId &&
  record.revision === record.document.revision &&
  isProjectAssets(record.assets) &&
  Array.isArray(record.activity) &&
  Number.isFinite(Date.parse(record.savedAt)) &&
  validateProjectDocument(record.document).valid;

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
  JSON.stringify(left.activity) === JSON.stringify(right.activity);
