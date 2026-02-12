import { isAllowedAuthoringFormatId, resolveFormatId } from '../../domain/formats';
import { withFormatOverrideHint } from '../formatHints';
import { buildProjectDialogDefaults } from '../../domain/project/projectDialogDefaults';
import { ensureNonBlankString } from '../../shared/payloadValidation';
import {
  ADAPTER_PROJECT_UNSAVED_CHANGES,
  PROJECT_AUTHORING_FORMAT_ID_MISSING,
  PROJECT_AUTHORING_FORMAT_ID_MISSING_FIX,
  PROJECT_AUTHORING_NOT_ENABLED,
  PROJECT_UNSUPPORTED_FORMAT,
  PROJECT_FORMAT_UNSUPPORTED_FIX,
  PROJECT_NAME_REQUIRED_FIX,
} from '../../shared/messages';
import type { ProjectServiceDeps } from './projectServiceTypes';
import { ok, fail, type UsecaseResult } from '../result';

export type ProjectCreateContext = Pick<
  ProjectServiceDeps,
  'capabilities' | 'editor' | 'formats' | 'session' | 'ensureRevisionMatch' | 'policies'
>;

export const runCreateProject = (
  ctx: ProjectCreateContext,
  name: string,
  options?: { confirmDiscard?: boolean; dialog?: Record<string, unknown>; ifRevision?: string }
): UsecaseResult<{ id: string; name: string }> => {
  const revisionErr = ctx.ensureRevisionMatch(options?.ifRevision);
  if (revisionErr) {
    return fail(revisionErr);
  }
  const nameBlankErr = ensureNonBlankString(name, 'Project name');
  if (nameBlankErr) {
    return fail({
      ...nameBlankErr,
      fix: PROJECT_NAME_REQUIRED_FIX
    });
  }
  const capability = ctx.capabilities.authoring;
  if (!capability.enabled) {
    return fail({
      code: 'unsupported_format',
      message: PROJECT_AUTHORING_NOT_ENABLED,
      fix: PROJECT_FORMAT_UNSUPPORTED_FIX
    });
  }
  const formats = ctx.formats.listFormats();
  const resolved = resolveFormatId(
    formats,
    ctx.policies.formatOverrides,
    ctx.formats.getActiveFormatId()
  );
  const allowedCandidates = Array.from(
    new Set(formats.map((format) => format.id).filter((id) => isAllowedAuthoringFormatId(id)))
  );
  const formatId = resolved ?? (allowedCandidates.length === 1 ? allowedCandidates[0] : null);
  if (!formatId) {
    return fail({
      code: 'unsupported_format',
      message: withFormatOverrideHint(PROJECT_AUTHORING_FORMAT_ID_MISSING),
      fix: PROJECT_AUTHORING_FORMAT_ID_MISSING_FIX
    });
  }
  if (!isAllowedAuthoringFormatId(formatId)) {
    return fail({
      code: 'unsupported_format',
      message: PROJECT_UNSUPPORTED_FORMAT(formatId),
      fix: PROJECT_FORMAT_UNSUPPORTED_FIX
    });
  }
  const explicitConfirmDiscard = options?.confirmDiscard;
  const dialogDefaults = buildProjectDialogDefaults({ formatId, name });
  const { ifRevision: _ifRevision, dialog: dialogOverrides, ...editorOptions } = options ?? {};
  const mergedDialog = mergeDialogValues(dialogDefaults, dialogOverrides);
  const effectiveConfirmDiscard = editorOptions.confirmDiscard ?? ctx.policies.autoDiscardUnsaved;
  const nextOptions =
    effectiveConfirmDiscard === undefined
      ? editorOptions
      : { ...editorOptions, confirmDiscard: effectiveConfirmDiscard };
  const editorPayload = mergedDialog ? { ...nextOptions, dialog: mergedDialog } : nextOptions;
  const err = ctx.editor.createProject(name, formatId, editorPayload);
  if (err) {
    if (shouldRetryDiscardUnsaved(err, explicitConfirmDiscard, ctx.policies.autoDiscardUnsaved)) {
      const retryOptions = { ...editorPayload, confirmDiscard: true };
      const retryErr = ctx.editor.createProject(name, formatId, retryOptions);
      if (retryErr) return fail(retryErr);
    } else {
      return fail(err);
    }
  }
  const result = ctx.session.create(name, formatId);
  if (!result.ok) {
    return fail(result.error);
  }
  return ok({ id: result.data.id, name: result.data.name });
};

const mergeDialogValues = (
  defaults: Record<string, unknown>,
  overrides?: Record<string, unknown>
): Record<string, unknown> | undefined => {
  const merged: Record<string, unknown> = {};
  let hasEntries = false;
  const assign = (source?: Record<string, unknown>) => {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      merged[key] = value;
      hasEntries = true;
    }
  };
  assign(defaults);
  assign(overrides);
  return hasEntries ? merged : undefined;
};

const shouldRetryDiscardUnsaved = (
  error: { code: string; message: string },
  explicitConfirmDiscard: boolean | undefined,
  autoDiscardUnsaved: boolean | undefined
): boolean => {
  if (!autoDiscardUnsaved) return false;
  if (explicitConfirmDiscard !== false) return false;
  return error.code === 'invalid_state' && error.message === ADAPTER_PROJECT_UNSAVED_CHANGES;
};
