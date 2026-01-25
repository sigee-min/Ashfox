import type { ToolError } from '../types';

export const buildMissingRevisionError = (currentRevision?: string, active?: boolean): ToolError => ({
  code: 'invalid_state',
  message: 'ifRevision is required. Call get_project_state before mutating.',
  fix: 'Call get_project_state and retry with ifRevision set to the returned revision.',
  details: {
    reason: 'missing_ifRevision',
    ...(currentRevision ? { currentRevision } : {}),
    ...(typeof active === 'boolean' ? { active } : {})
  }
});

export const buildRevisionMismatchError = (expected: string, currentRevision: string): ToolError => ({
  code: 'invalid_state_revision_mismatch',
  message: 'Project revision mismatch. Refresh project state before retrying.',
  fix: 'Call get_project_state and retry with the latest revision.',
  details: { expected, currentRevision, reason: 'revision_mismatch' }
});
