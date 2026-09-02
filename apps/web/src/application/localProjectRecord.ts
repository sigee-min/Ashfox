import {
  writeWorkspaceFile,
  type AuthoredAssetWorkspace,
  type WorkspaceEntrySelector
} from '@ashfox/engine-core';
import {
  hasExactContractKeys,
  isCanonicalIsoDate,
  isClosedContractRecord,
  isNonEmptyContractText,
  LOCAL_PROJECT_RECORD_SCHEMA_VERSION as CURRENT_LOCAL_PROJECT_RECORD_SCHEMA_VERSION
} from '@ashfox/internal-contracts';

export const LOCAL_PROJECT_SCHEMA_VERSION =
  CURRENT_LOCAL_PROJECT_RECORD_SCHEMA_VERSION;

/** Durable browser authority; products are rebuilt from the selected entry. */
export interface LocalProjectRecord {
  readonly schemaVersion: typeof LOCAL_PROJECT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly revision: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly workspace: AuthoredAssetWorkspace;
  readonly entry: WorkspaceEntrySelector;
  readonly savedAt: string;
}

const LOCAL_PROJECT_RECORD_KEYS = new Set([
  'schemaVersion', 'projectId', 'revision', 'createdAt', 'updatedAt',
  'workspace', 'entry', 'savedAt'
]);

export interface CreateLocalProjectRecordInput {
  readonly projectId: string;
  readonly revision: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly workspace: AuthoredAssetWorkspace;
  readonly entry: WorkspaceEntrySelector;
  readonly savedAt: string;
}

export const createLocalProjectRecord = ({
  projectId, revision, createdAt, updatedAt, workspace, entry, savedAt
}: CreateLocalProjectRecordInput): LocalProjectRecord => ({
  schemaVersion: LOCAL_PROJECT_SCHEMA_VERSION,
  projectId,
  revision,
  createdAt,
  updatedAt,
  workspace,
  entry,
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

const isEntrySelector = (value: unknown): value is WorkspaceEntrySelector =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, new Set(['packageName', 'entryName'])) &&
  isNonEmptyContractText(value.packageName) &&
  isNonEmptyContractText(value.entryName) &&
  /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value.entryName);

const workspaceContainsEntry = (
  workspace: AuthoredAssetWorkspace,
  entry: WorkspaceEntrySelector
): boolean => workspace.manifest.packages.some((pkg) =>
  pkg.name === entry.packageName &&
  pkg.manifest.entries.some((candidate) => candidate.name === entry.entryName));

export const isValidLocalProjectRecord = (
  value: unknown,
  projectId: string
): value is LocalProjectRecord => {
  if (!isClosedContractRecord(value) ||
    !hasExactContractKeys(value, LOCAL_PROJECT_RECORD_KEYS) ||
    value.schemaVersion !== LOCAL_PROJECT_SCHEMA_VERSION ||
    !isNonEmptyContractText(value.projectId) || value.projectId !== projectId ||
    !isNonEmptyContractText(value.revision) ||
    !isCanonicalIsoDate(value.createdAt) || !isCanonicalIsoDate(value.updatedAt) ||
    !isCanonicalIsoDate(value.savedAt) || !isEntrySelector(value.entry) ||
    typeof value.workspace !== 'object' || value.workspace === null) return false;
  try {
    return writeWorkspaceFile(value.workspace as AuthoredAssetWorkspace).ok &&
      workspaceContainsEntry(value.workspace as AuthoredAssetWorkspace, value.entry);
  } catch {
    return false;
  }
};

export const parseLocalProjectRecord = (
  value: unknown,
  projectId: string
): LocalProjectRecord => {
  if (!isValidLocalProjectRecord(value, projectId)) {
    throw new Error('Stored local workspace failed the exact-current contract.');
  }
  return {
    schemaVersion: value.schemaVersion,
    projectId: value.projectId,
    revision: value.revision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    workspace: value.workspace,
    entry: value.entry,
    savedAt: value.savedAt
  };
};

const workspaceEncoding = (workspace: AuthoredAssetWorkspace): string | null => {
  try {
    const result = writeWorkspaceFile(workspace);
    return result.ok ? result.source : null;
  } catch {
    return null;
  }
};

export const areLocalProjectRecordsEqual = (
  left: LocalProjectRecord,
  right: LocalProjectRecord
): boolean => left.projectId === right.projectId &&
  left.revision === right.revision && left.createdAt === right.createdAt &&
  left.updatedAt === right.updatedAt && left.savedAt === right.savedAt &&
  left.entry.packageName === right.entry.packageName &&
  left.entry.entryName === right.entry.entryName &&
  workspaceEncoding(left.workspace) === workspaceEncoding(right.workspace);
