import type { ProjectDiff, ProjectState, ProjectStateDetail, ToolError, ToolResponse } from '../types';

type ResultLike<T> = { ok: true; value: T } | { ok: false; error: ToolError };

export type StateAttachmentDeps = {
  includeStateByDefault: () => boolean;
  includeDiffByDefault: () => boolean;
  getProjectState: (payload: { detail: ProjectStateDetail }) => ResultLike<{ project: ProjectState }>;
  getProjectDiff: (payload: { sinceRevision: string; detail?: ProjectStateDetail }) => ResultLike<{ diff: ProjectDiff }>;
};

type StatePayload = {
  includeState?: boolean;
  includeDiff?: boolean;
  diffDetail?: ProjectStateDetail;
  ifRevision?: string;
};

export const attachStateToResponse = <TPayload extends StatePayload, TResult>(
  deps: StateAttachmentDeps,
  payload: TPayload,
  response: ToolResponse<TResult>
): ToolResponse<TResult & { state?: ProjectState | null; diff?: ProjectDiff | null; revision?: string }> => {
  const shouldIncludeState = payload?.includeState ?? deps.includeStateByDefault();
  const shouldIncludeDiff = payload?.includeDiff ?? deps.includeDiffByDefault();
  const shouldIncludeRevision = true;
  if (!shouldIncludeState && !shouldIncludeDiff && !shouldIncludeRevision) {
    return response as ToolResponse<TResult & { state?: ProjectState | null; diff?: ProjectDiff | null; revision?: string }>;
  }
  const state = deps.getProjectState({ detail: 'summary' });
  const project = state.ok ? state.value.project : null;
  const revision = project?.revision;
  let diffValue: ProjectDiff | null | undefined;
  if (shouldIncludeDiff) {
    if (payload?.ifRevision) {
      const diff = deps.getProjectDiff({
        sinceRevision: payload.ifRevision,
        detail: payload.diffDetail ?? 'summary'
      });
      diffValue = diff.ok ? diff.value.diff : null;
    } else {
      diffValue = null;
    }
  }
  if (response.ok) {
    return {
      ok: true,
      ...(response.content ? { content: response.content } : {}),
      ...(response.structuredContent ? { structuredContent: response.structuredContent } : {}),
      data: {
        ...(response.data as Record<string, unknown>),
        ...(shouldIncludeRevision && revision ? { revision } : {}),
        ...(shouldIncludeState ? { state: project } : {}),
        ...(shouldIncludeDiff ? { diff: diffValue ?? null } : {})
      } as TResult & { state?: ProjectState | null; diff?: ProjectDiff | null; revision?: string }
    };
  }
  const details: Record<string, unknown> = { ...(response.error.details ?? {}) };
  if (shouldIncludeRevision && revision) {
    details.revision = revision;
  }
  if (shouldIncludeState) {
    details.state = project;
  }
  if (shouldIncludeDiff) {
    details.diff = diffValue ?? null;
  }
  return {
    ok: false,
    ...(response.content ? { content: response.content } : {}),
    ...(response.structuredContent ? { structuredContent: response.structuredContent } : {}),
    error: { ...response.error, details }
  };
};
