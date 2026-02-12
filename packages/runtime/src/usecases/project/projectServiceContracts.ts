import type {
  EnsureProjectAction,
  ProjectDiff,
  ProjectState,
  ProjectStateDetail
} from '@ashfox/contracts/types/internal';

export type GetProjectStatePayload = { detail?: ProjectStateDetail; includeUsage?: boolean };

export type GetProjectStateResult = { project: ProjectState };

export type GetProjectDiffPayload = { sinceRevision: string; detail?: ProjectStateDetail };

export type GetProjectDiffResult = { diff: ProjectDiff };

export type EnsureProjectPayload = {
  action?: EnsureProjectAction;
  target?: { name?: string };
  name?: string;
  match?: 'none' | 'name';
  onMismatch?: 'reuse' | 'error' | 'create';
  onMissing?: 'create' | 'error';
  confirmDiscard?: boolean;
  force?: boolean;
  uvPixelsPerBlock?: number;
  dialog?: Record<string, unknown>;
  ifRevision?: string;
};

export type EnsureProjectResult = {
  action: 'created' | 'reused' | 'deleted';
  project: { id: string; name: string | null; formatId?: string | null };
};

export type CreateProjectOptions = {
  confirmDiscard?: boolean;
  dialog?: Record<string, unknown>;
  ifRevision?: string;
  uvPixelsPerBlock?: number;
};

export type CreateProjectResult = { id: string; name: string };
