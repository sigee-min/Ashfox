import {
  computeWorkspaceHash,
  type AssetProject,
  type WorkspaceEntrySelector
} from '@ashfox/engine-core';

const MAX_CANDIDATE_PREVIEWS = 8;
export const CANDIDATE_PREVIEW_TTL_MS = 30_000;

interface CandidatePreviewEntry {
  readonly projectId: AssetProject['id'];
  readonly revision: AssetProject['revision'];
  readonly baseWorkspaceHash: AssetProject['build']['workspaceHash'];
  readonly baseEntry: WorkspaceEntrySelector;
  readonly candidateEntry: WorkspaceEntrySelector;
  readonly candidateProductHash: AssetProject['build']['productHash'];
  readonly project: AssetProject;
  readonly expiresAt: number;
}

const entries = new Map<string, CandidatePreviewEntry>();

const randomToken = (): string | null => {
  try {
    if (typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.randomUUID === 'function') {
      return `candidate-preview-${globalThis.crypto.randomUUID()}`;
    }
    if (typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.getRandomValues === 'function') {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
      return `candidate-preview-${Array.from(bytes, (value) =>
        value.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch {
    // Candidate tokens must never fall back to predictable randomness.
  }
  return null;
};

const sameEntry = (
  left: WorkspaceEntrySelector,
  right: WorkspaceEntrySelector
): boolean => left.packageName === right.packageName &&
  left.entryName === right.entryName;

const isProjectWorkspaceCurrent = (project: AssetProject): boolean => {
  try {
    return project.build.workspaceHash === computeWorkspaceHash(project.workspace);
  } catch {
    return false;
  }
};

const prune = (now: number): void => {
  for (const [token, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(token);
  }
  while (entries.size > MAX_CANDIDATE_PREVIEWS) {
    const oldest = entries.keys().next().value;
    if (typeof oldest !== 'string') return;
    entries.delete(oldest);
  }
};

/** Store a compiler-created candidate only in the transient Web process. */
export const createCandidatePreview = (
  base: AssetProject,
  candidate: AssetProject
): string | null => {
  if (base.id !== candidate.id ||
    base.revision !== candidate.revision ||
    !isProjectWorkspaceCurrent(base) ||
    !isProjectWorkspaceCurrent(candidate) ||
    candidate.build.productHash.length === 0) return null;
  const token = randomToken();
  if (token === null) return null;
  const now = Date.now();
  prune(now);
  entries.set(token, {
    projectId: base.id,
    revision: base.revision,
    baseWorkspaceHash: base.build.workspaceHash,
    baseEntry: { ...base.entry },
    candidateEntry: { ...candidate.entry },
    candidateProductHash: candidate.build.productHash,
    project: candidate,
    expiresAt: now + CANDIDATE_PREVIEW_TTL_MS
  });
  prune(now);
  return token;
};

/** Read a candidate only while every host/build binding remains unchanged. */
export const candidatePreviewFor = (
  base: AssetProject,
  token: string
): AssetProject | null => {
  const now = Date.now();
  prune(now);
  const entry = entries.get(token);
  const valid = entry !== undefined &&
    entry.projectId === base.id &&
    entry.revision === base.revision &&
    entry.baseWorkspaceHash === base.build.workspaceHash &&
    sameEntry(entry.baseEntry, base.entry) &&
    isProjectWorkspaceCurrent(base) &&
    entry.candidateProductHash === entry.project.build.productHash &&
    sameEntry(entry.candidateEntry, entry.project.entry) &&
    isProjectWorkspaceCurrent(entry.project);
  if (!valid) {
    if (entry !== undefined) entries.delete(token);
    return null;
  }
  entries.delete(token);
  entries.set(token, entry);
  return entry.project;
};
