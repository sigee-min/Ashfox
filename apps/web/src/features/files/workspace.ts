import {
  ASHFOX_WORKSPACE_FILE_CONTENT_TYPE,
  ASHFOX_WORKSPACE_FILE_EXTENSION,
  openAssetProject,
  readWorkspaceFile,
  writeWorkspaceFile,
  type AssetProject,
  type AssetProjectIdentitySeed,
  type AuthoredAssetWorkspace,
  type WorkspaceEntrySelector
} from '@ashfox/engine-core';
import {
  createArtifactBinding,
  safeArtifactName,
  type ArtifactFile
} from './artifactFile';

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08]
] as const;
const MAX_WORKSPACE_FILE_BYTES = 64 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const diagnosticText = (diagnostics: readonly { message: string; source?: {
  start: { line: number; column: number };
  path: string;
} }[]): string => diagnostics.map((entry) =>
  `${entry.source?.start.line ?? 1}:${entry.source?.start.column ?? 1} ` +
  `${entry.source?.path ?? 'workspace'} ${entry.message}`
).join('\n');

const workspaceError = (diagnostics: readonly { message: string; source?: {
  start: { line: number; column: number };
  path: string;
} }[]): Error => new Error(
  `Workspace could not be opened:\n${diagnosticText(diagnostics)}`
);

const selectedWorkspaceEntry = (
  workspace: AuthoredAssetWorkspace,
  preferred: WorkspaceEntrySelector
): WorkspaceEntrySelector => {
  if (typeof preferred?.packageName !== 'string' ||
      typeof preferred.entryName !== 'string') throw new Error(
    'Workspace entry selection is invalid.'
  );
  const preferredPackage = workspace.manifest.packages.find(
    (candidate) => candidate.name === preferred.packageName
  );
  if (preferredPackage?.manifest.entries.some(
    (candidate) => candidate.name === preferred.entryName
  )) return preferred;
  const firstPackage = workspace.manifest.packages.find(
    (candidate) => candidate.manifest.entries.length > 0
  );
  const firstEntry = firstPackage?.manifest.entries[0];
  if (!firstPackage || !firstEntry) throw new Error(
    'Workspace does not declare an asset entry.'
  );
  return {
    packageName: firstPackage.name,
    entryName: firstEntry.name
  };
};

/** Compile one workspace source with an explicit package/entry selection. */
export const openWorkspaceSource = (
  source: string,
  identity: AssetProjectIdentitySeed,
  entry: WorkspaceEntrySelector
): AssetProject => {
  const parsed = readWorkspaceFile(source);
  if (!parsed.ok) throw workspaceError(parsed.diagnostics);
  const opened = openAssetProject({
    workspace: parsed.workspace,
    entry,
    identity
  });
  if (!opened.ok) throw workspaceError(opened.diagnostics);
  return opened.project;
};

/** Decode a workspace container; ZIP, BOM, lossy UTF-8, and oversize input fail. */
export const readWorkspaceSource = (
  bytes: Uint8Array,
  identity: AssetProjectIdentitySeed,
  entry: WorkspaceEntrySelector
): AssetProject => {
  if (ZIP_SIGNATURES.some((signature) => startsWith(bytes, signature))) {
    throw new Error('ZIP-based workspace files are not supported.');
  }
  if (bytes.byteLength > MAX_WORKSPACE_FILE_BYTES) {
    throw new Error(`Workspace file exceeds the ${MAX_WORKSPACE_FILE_BYTES}-byte limit.`);
  }
  if (startsWith(bytes, UTF8_BOM)) {
    throw new Error('Workspace files must be UTF-8 without a byte-order mark.');
  }
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Workspace file is not valid UTF-8.');
  }
  return openWorkspaceSource(source, identity, entry);
};

export const createOpenIdentity = (
  createdAt: string = new Date().toISOString(),
  projectId: string = `project-${crypto.randomUUID()}`
): AssetProjectIdentitySeed => ({
  id: projectId,
  revision: 'local-0001',
  createdAt,
  updatedAt: createdAt
});

export const parseWorkspaceFile = async (
  file: File,
  entry: WorkspaceEntrySelector,
  identity: AssetProjectIdentitySeed = createOpenIdentity()
): Promise<AssetProject> => {
  if (!file.name.endsWith(ASHFOX_WORKSPACE_FILE_EXTENSION)) {
    throw new Error(
      `Workspace files must use the ${ASHFOX_WORKSPACE_FILE_EXTENSION} extension.`
    );
  }
  if (file.size > MAX_WORKSPACE_FILE_BYTES) {
    throw new Error(`Workspace file exceeds the ${MAX_WORKSPACE_FILE_BYTES}-byte limit.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = readWorkspaceFile(bytes);
  if (!decoded.ok) throw workspaceError(decoded.diagnostics);
  const selected = selectedWorkspaceEntry(decoded.workspace, entry);
  const opened = openAssetProject({
    workspace: decoded.workspace,
    entry: selected,
    identity
  });
  if (!opened.ok) throw workspaceError(opened.diagnostics);
  return opened.project;
};

/** Emit the workspace authority as the downloadable `.ashfoxworkspace` file. */
export const createWorkspaceArtifact = async (
  project: AssetProject
): Promise<ArtifactFile> => {
  const serialized = writeWorkspaceFile(project.workspace);
  if (!serialized.ok) throw workspaceError(serialized.diagnostics);
  const bytes = new TextEncoder().encode(serialized.source);
  return {
    ...await createArtifactBinding(project, bytes),
    kind: 'project',
    name: `${safeArtifactName(project.document.name)}${ASHFOX_WORKSPACE_FILE_EXTENSION}`,
    bytes,
    contentType: ASHFOX_WORKSPACE_FILE_CONTENT_TYPE
  };
};
