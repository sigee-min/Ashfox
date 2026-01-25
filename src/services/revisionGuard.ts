import type { ProjectState, ToolError } from '../types';
import { buildMissingRevisionError, buildRevisionMismatchError } from './revisionErrors';

type Result<T> = { ok: true; value: T } | { ok: false; error: ToolError };

export type RevisionGuardDeps = {
  requiresRevision: boolean;
  allowAutoRetry: boolean;
  getProjectState: () => Result<{ project: ProjectState }>;
};

export type RevisionDecision =
  | { ok: true; action: 'proceed' | 'retry'; currentRevision: string; project: ProjectState }
  | { ok: true; action: 'proceed'; currentRevision?: string; project?: ProjectState }
  | { ok: false; error: ToolError };

export const decideRevision = (
  expected: string | undefined,
  deps: RevisionGuardDeps
): RevisionDecision => {
  if (!deps.requiresRevision) {
    return { ok: true, action: 'proceed' };
  }
  const state = deps.getProjectState();
  if (!state.ok) {
    return { ok: false, error: state.error };
  }
  const project = state.value.project;
  const currentRevision = project.revision;
  if (!expected) {
    return { ok: false, error: buildMissingRevisionError(currentRevision, project.active) };
  }
  if (currentRevision !== expected) {
    if (deps.allowAutoRetry) {
      return { ok: true, action: 'retry', currentRevision, project };
    }
    return { ok: false, error: buildRevisionMismatchError(expected, currentRevision) };
  }
  return { ok: true, action: 'proceed', currentRevision, project };
};
