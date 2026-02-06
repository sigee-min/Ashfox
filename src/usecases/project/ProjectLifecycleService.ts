import type { Capabilities, EnsureProjectAction, FormatKind, ToolError } from '../../types';
import { ok, fail, type UsecaseResult } from '../result';
import { ensureNonBlankString } from '../../shared/payloadValidation';
import {
  PROJECT_CREATE_REQUIREMENTS,
  PROJECT_CREATE_REQUIREMENTS_ON_MISMATCH_FIX,
  PROJECT_CREATE_REQUIREMENTS_ON_MISSING_FIX,
  PROJECT_FORMAT_UNKNOWN,
  PROJECT_MATCH_FORMAT_REQUIRED,
  PROJECT_MATCH_NAME_REQUIRED,
  PROJECT_MISMATCH,
  PROJECT_NO_ACTIVE,
  PROJECT_UV_PIXELS_PER_BLOCK_INVALID,
} from '../../shared/messages';
import { DEFAULT_UV_POLICY } from '../../domain/uv/policy';
import { estimateUvPixelsPerBlock } from '../../domain/uv/density';
import { toDomainSnapshot, toDomainTextureUsage } from '../domainMappers';
import type { ProjectServiceDeps } from './projectServiceTypes';
import { runCreateProject } from './projectCreation';
import { runDeleteProject } from './projectDeletion';

export class ProjectLifecycleService {
  private readonly session: ProjectServiceDeps['session'];
  private readonly capabilities: ProjectServiceDeps['capabilities'];
  private readonly editor: ProjectServiceDeps['editor'];
  private readonly formats: ProjectServiceDeps['formats'];
  private readonly projectState: ProjectServiceDeps['projectState'];
  private readonly getSnapshot: ProjectServiceDeps['getSnapshot'];
  private readonly ensureRevisionMatch: ProjectServiceDeps['ensureRevisionMatch'];
  private readonly runWithoutRevisionGuard?: ProjectServiceDeps['runWithoutRevisionGuard'];
  private readonly texture?: ProjectServiceDeps['texture'];
  private readonly policies: ProjectServiceDeps['policies'];

  constructor(deps: ProjectServiceDeps) {
    this.session = deps.session;
    this.capabilities = deps.capabilities;
    this.editor = deps.editor;
    this.formats = deps.formats;
    this.projectState = deps.projectState;
    this.getSnapshot = deps.getSnapshot;
    this.ensureRevisionMatch = deps.ensureRevisionMatch;
    this.runWithoutRevisionGuard = deps.runWithoutRevisionGuard;
    this.texture = deps.texture;
    this.policies = deps.policies;
  }

  ensureProject(payload: {
    action?: EnsureProjectAction;
    target?: { name?: string };
    format?: Capabilities['formats'][number]['format'];
    name?: string;
    match?: 'none' | 'format' | 'name' | 'format_and_name';
    onMismatch?: 'reuse' | 'error' | 'create';
    onMissing?: 'create' | 'error';
    confirmDiscard?: boolean;
    force?: boolean;
    uvPixelsPerBlock?: number;
    dialog?: Record<string, unknown>;
    ifRevision?: string;
  }): UsecaseResult<{ action: 'created' | 'reused' | 'deleted'; project: { id: string; format: FormatKind; name: string | null; formatId?: string | null } }> {
    const action: EnsureProjectAction = payload.action ?? 'ensure';
    if (action === 'delete') {
      return runDeleteProject(this.buildDeleteContext(), payload);
    }
    const matchMode = payload.match ?? 'none';
    const onMissing = payload.onMissing ?? 'create';
    const onMismatch = payload.onMismatch ?? 'reuse';
    const requiresFormat = matchMode === 'format' || matchMode === 'format_and_name';
    const requiresName = matchMode === 'name' || matchMode === 'format_and_name';
    const formatBlankErr = ensureNonBlankString(payload.format, 'format');
    if (formatBlankErr) return fail(formatBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.name, 'name');
    if (nameBlankErr) return fail(nameBlankErr);
    if (requiresFormat && !payload.format) {
      return fail({
        code: 'invalid_payload',
        message: PROJECT_MATCH_FORMAT_REQUIRED
      });
    }
    if (requiresName && !payload.name) {
      return fail({
        code: 'invalid_payload',
        message: PROJECT_MATCH_NAME_REQUIRED
      });
    }

    const snapshot = this.getSnapshot();
    const normalized = this.projectState.normalize(snapshot);
    const info = this.projectState.toProjectInfo(normalized);
    const hasActive = Boolean(info && normalized.format);

    const normalizedUv = this.normalizeUvPixelsPerBlock(payload.uvPixelsPerBlock);
    if (payload.uvPixelsPerBlock !== undefined && normalizedUv === null) {
      return fail({ code: 'invalid_payload', message: PROJECT_UV_PIXELS_PER_BLOCK_INVALID });
    }

    if (!hasActive) {
      if (onMissing === 'error') {
        return fail({ code: 'invalid_state', message: PROJECT_NO_ACTIVE });
      }
      if (!payload.format || !payload.name) {
        return fail({
          code: 'invalid_payload',
          message: PROJECT_CREATE_REQUIREMENTS,
          fix: PROJECT_CREATE_REQUIREMENTS_ON_MISSING_FIX
        });
      }
      const created = runCreateProject(this.buildCreateContext(), payload.format, payload.name, {
        confirmDiscard: payload.confirmDiscard,
        dialog: payload.dialog,
        ifRevision: payload.ifRevision
      });
      if (!created.ok) return created;
      const uvErr = this.applyUvPixelsPerBlock(normalizedUv);
      if (uvErr) return fail(uvErr);
      this.maybeCreateProjectTexture(created.value.name);
      const sessionState = this.session.snapshot();
      return ok({
        action: 'created',
        project: {
          id: created.value.id,
          format: created.value.format,
          name: created.value.name,
          formatId: sessionState.formatId ?? null
        }
      });
    }

    if (!normalized.format || !info) {
      return fail({ code: 'invalid_state', message: PROJECT_FORMAT_UNKNOWN });
    }

    const formatMismatch = requiresFormat && payload.format && normalized.format !== payload.format;
    const nameMismatch = requiresName && payload.name && info.name !== payload.name;
    const mismatch = formatMismatch || nameMismatch;

    if (mismatch && onMismatch === 'error') {
      return fail({
        code: 'invalid_state',
        message: PROJECT_MISMATCH,
        details: {
          expected: { format: payload.format ?? null, name: payload.name ?? null, match: matchMode },
          actual: { format: normalized.format, name: info.name ?? null }
        }
      });
    }

    if (mismatch && onMismatch === 'create') {
      if (!payload.format || !payload.name) {
        return fail({
          code: 'invalid_payload',
          message: PROJECT_CREATE_REQUIREMENTS,
          fix: PROJECT_CREATE_REQUIREMENTS_ON_MISMATCH_FIX
        });
      }
      const created = runCreateProject(this.buildCreateContext(), payload.format, payload.name, {
        confirmDiscard: payload.confirmDiscard,
        dialog: payload.dialog,
        ifRevision: payload.ifRevision
      });
      if (!created.ok) return created;
      const uvErr = this.applyUvPixelsPerBlock(normalizedUv);
      if (uvErr) return fail(uvErr);
      this.maybeCreateProjectTexture(created.value.name);
      const sessionState = this.session.snapshot();
      return ok({
        action: 'created',
        project: {
          id: created.value.id,
          format: created.value.format,
          name: created.value.name,
          formatId: sessionState.formatId ?? null
        }
      });
    }

    const attachRes = this.session.attach(normalized);
    if (!attachRes.ok) return fail(attachRes.error);
    const inferredUv = this.inferUvPixelsPerBlock(normalizedUv);
    const uvErr = this.applyUvPixelsPerBlock(normalizedUv ?? inferredUv);
    if (uvErr) return fail(uvErr);
    return ok({
      action: 'reused',
      project: {
        id: attachRes.data.id,
        format: normalized.format,
        name: attachRes.data.name,
        formatId: normalized.formatId ?? null
      }
    });
  }

  createProject(
    format: Capabilities['formats'][number]['format'],
    name: string,
    options?: { confirmDiscard?: boolean; dialog?: Record<string, unknown>; ifRevision?: string; uvPixelsPerBlock?: number }
  ): UsecaseResult<{ id: string; format: FormatKind; name: string }> {
    const created = runCreateProject(this.buildCreateContext(), format, name, options);
    if (created.ok) {
      const normalizedUv = this.normalizeUvPixelsPerBlock(options?.uvPixelsPerBlock);
      if (options?.uvPixelsPerBlock !== undefined && normalizedUv === null) {
        return fail({ code: 'invalid_payload', message: PROJECT_UV_PIXELS_PER_BLOCK_INVALID });
      }
      const uvErr = this.applyUvPixelsPerBlock(normalizedUv);
      if (uvErr) return fail(uvErr);
      this.maybeCreateProjectTexture(created.value.name);
    }
    return created;
  }

  private maybeCreateProjectTexture(name: string | null) {
    if (!this.policies.autoCreateProjectTexture) return;
    if (!this.texture) return;
    const textureName = String(name ?? '').trim() || 'texture';
    const runner = this.runWithoutRevisionGuard ?? ((fn: () => unknown) => fn());
    runner(() => {
      const result = this.texture!.createBlankTexture({
        name: textureName,
        allowExisting: true
      });
      return result;
    });
  }

  private normalizeUvPixelsPerBlock(value?: number): number | null | undefined {
    if (value === undefined) return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.trunc(numeric);
  }

  private applyUvPixelsPerBlock(value?: number | null): ToolError | null {
    if (value === undefined || value === null) return null;
    const err = this.editor.setProjectUvPixelsPerBlock(value);
    if (err) return err;
    this.session.setUvPixelsPerBlock(value);
    return null;
  }

  private inferUvPixelsPerBlock(explicit?: number | null): number | undefined {
    if (explicit !== undefined && explicit !== null) return undefined;
    if (this.session.snapshot().uvPixelsPerBlock !== undefined) return undefined;
    const usageRes = this.editor.getTextureUsage({});
    if (usageRes.error) return undefined;
    const usageRaw = usageRes.result ?? { textures: [] };
    if (!usageRaw.textures.length) return undefined;
    const usage = toDomainTextureUsage(usageRaw);
    const snapshot = toDomainSnapshot(this.getSnapshot());
    const policy = this.policies.uvPolicy ?? DEFAULT_UV_POLICY;
    const inferred = estimateUvPixelsPerBlock(usage, snapshot.cubes, policy);
    return inferred ?? undefined;
  }

  private buildCreateContext() {
    return {
      capabilities: this.capabilities,
      editor: this.editor,
      formats: this.formats,
      session: this.session,
      ensureRevisionMatch: this.ensureRevisionMatch,
      policies: this.policies
    };
  }

  private buildDeleteContext() {
    return {
      session: this.session,
      editor: this.editor,
      projectState: this.projectState,
      getSnapshot: this.getSnapshot,
      ensureRevisionMatch: this.ensureRevisionMatch
    };
  }
}
