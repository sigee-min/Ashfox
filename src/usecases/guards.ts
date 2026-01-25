import type { ToolError } from '../types';

type EnsureActive = () => ToolError | null;
type EnsureRevision = (ifRevision?: string) => ToolError | null;

export const ensureActiveOnly = (ensureActive: EnsureActive): ToolError | null => ensureActive();

export const ensureActiveAndRevision = (
  ensureActive: EnsureActive,
  ensureRevision: EnsureRevision,
  ifRevision?: string,
  options?: { skipRevisionCheck?: boolean }
): ToolError | null => {
  const activeErr = ensureActive();
  if (activeErr) return activeErr;
  if (options?.skipRevisionCheck) return null;
  return ensureRevision(ifRevision);
};
