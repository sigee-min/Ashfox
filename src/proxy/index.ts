import { Logger } from '../logging';
import {
  Limits,
  ProjectDiff,
  ProjectState,
  ProjectStateDetail,
  RenderPreviewPayload,
  RenderPreviewResult,
  ToolPayloadMap,
  ToolResponse
} from '../types';
import {
  ApplyEntitySpecPayload,
  ApplyModelSpecPayload,
  ApplyTextureSpecPayload,
  ApplyUvSpecPayload,
  ProxyTool,
  TexturePipelinePayload
} from '../spec';
import { ToolService } from '../usecases/ToolService';
import { buildRenderPreviewContent, buildRenderPreviewStructured } from '../mcp/content';
import { applyModelSpecSteps, createApplyReport } from './apply';
import { toToolResponse } from './response';
import { validateModelSpec } from './validators';
import { createProxyPipeline } from './pipeline';
import { applyTextureSpecProxy, applyUvSpecProxy, texturePipelineProxy, type ProxyPipelineDeps } from './texturePipeline';
import { applyEntitySpecProxy } from './entityPipeline';

export class ProxyRouter {
  private readonly service: ToolService;
  private readonly log: Logger;
  private readonly limits: Limits;
  private readonly includeStateByDefault: () => boolean;
  private readonly includeDiffByDefault: () => boolean;

  constructor(
    service: ToolService,
    log: Logger,
    limits: Limits,
    options?: { includeStateByDefault?: boolean | (() => boolean); includeDiffByDefault?: boolean | (() => boolean) }
  ) {
    this.service = service;
    this.log = log;
    this.limits = limits;
    const flag = options?.includeStateByDefault;
    this.includeStateByDefault = typeof flag === 'function' ? flag : () => Boolean(flag);
    const diffFlag = options?.includeDiffByDefault;
    this.includeDiffByDefault = typeof diffFlag === 'function' ? diffFlag : () => Boolean(diffFlag);
  }

  async applyModelSpec(payload: ApplyModelSpecPayload): Promise<ToolResponse<unknown>> {
    const v = validateModelSpec(payload, this.limits);
    if (!v.ok) return v;
    const pipeline = createProxyPipeline({
      service: this.service,
      payload,
      includeStateByDefault: this.includeStateByDefault,
      includeDiffByDefault: this.includeDiffByDefault,
      runWithoutRevisionGuard: (fn) => this.runWithoutRevisionGuard(fn)
    });
    const revisionError = pipeline.guardRevision();
    if (revisionError) return revisionError;
    return pipeline.run(() => {
      const report = createApplyReport();
      const result = applyModelSpecSteps(this.service, this.log, payload, report, pipeline.meta);
      if (!result.ok) return result;
      return pipeline.ok({ applied: true, report });
    });
  }

  async applyTextureSpec(payload: ApplyTextureSpecPayload): Promise<ToolResponse<unknown>> {
    return applyTextureSpecProxy(this.getPipelineDeps(), payload);
  }

  async applyUvSpec(payload: ApplyUvSpecPayload): Promise<ToolResponse<unknown>> {
    return applyUvSpecProxy(this.getPipelineDeps(), payload);
  }

  async texturePipeline(payload: TexturePipelinePayload): Promise<ToolResponse<unknown>> {
    return texturePipelineProxy(this.getPipelineDeps(), payload);
  }

  async applyEntitySpec(payload: ApplyEntitySpecPayload): Promise<ToolResponse<unknown>> {
    return applyEntitySpecProxy(this.getPipelineDeps(), payload);
  }

  async handle(tool: ProxyTool, payload: unknown): Promise<ToolResponse<unknown>> {
    try {
      switch (tool) {
        case 'apply_model_spec':
          return await this.applyModelSpec(payload as ApplyModelSpecPayload);
        case 'apply_texture_spec':
          return await this.applyTextureSpec(payload as ApplyTextureSpecPayload);
        case 'apply_uv_spec':
          return await this.applyUvSpec(payload as ApplyUvSpecPayload);
        case 'texture_pipeline':
          return await this.texturePipeline(payload as TexturePipelinePayload);
        case 'apply_entity_spec':
          return await this.applyEntitySpec(payload as ApplyEntitySpecPayload);
        case 'render_preview':
          return attachRenderPreviewContent(
            this.attachState(
              payload as RenderPreviewPayload,
              toToolResponse(this.service.renderPreview(payload as RenderPreviewPayload))
            )
          );
        case 'validate':
          return this.attachState(
            payload as ToolPayloadMap['validate'],
            toToolResponse(this.service.validate(payload as ToolPayloadMap['validate']))
          );
        default:
          return { ok: false, error: { code: 'unknown', message: `Unknown proxy tool ${tool}` } };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.log.error('proxy handle error', { tool, message });
      return { ok: false, error: { code: 'unknown', message } };
    }
  }

  private async runWithoutRevisionGuard<T>(fn: () => Promise<T> | T): Promise<T> {
    const service = this.service as {
      runWithoutRevisionGuardAsync?: (inner: () => Promise<T>) => Promise<T>;
      runWithoutRevisionGuard?: (inner: () => T) => T;
    };
    if (typeof service.runWithoutRevisionGuardAsync === 'function') {
      return service.runWithoutRevisionGuardAsync(async () => await fn());
    }
    if (typeof service.runWithoutRevisionGuard === 'function') {
      const result = service.runWithoutRevisionGuard(() => {
        const value = fn();
        if (value && typeof (value as Promise<T>).then === 'function') {
          throw new Error('Async revision guard unavailable');
        }
        return value as T;
      });
      return result;
    }
    return await fn();
  }

  private getPipelineDeps(): ProxyPipelineDeps {
    return {
      service: this.service,
      log: this.log,
      limits: this.limits,
      includeStateByDefault: this.includeStateByDefault,
      includeDiffByDefault: this.includeDiffByDefault,
      runWithoutRevisionGuard: (fn) => this.runWithoutRevisionGuard(fn)
    };
  }

  private attachState<
    TPayload extends { includeState?: boolean; includeDiff?: boolean; diffDetail?: ProjectStateDetail; ifRevision?: string },
    TResult
  >(
    payload: TPayload,
    response: ToolResponse<TResult>
  ): ToolResponse<TResult & { state?: ProjectState | null; diff?: ProjectDiff | null; revision?: string }> {
    const shouldIncludeState = payload?.includeState ?? this.includeStateByDefault();
    const shouldIncludeDiff = payload?.includeDiff ?? this.includeDiffByDefault();
    const shouldIncludeRevision = true;
    if (!shouldIncludeState && !shouldIncludeDiff && !shouldIncludeRevision) {
      return response as ToolResponse<TResult & { state?: ProjectState | null; diff?: ProjectDiff | null; revision?: string }>;
    }
    const state = this.service.getProjectState({ detail: 'summary' });
    const project = state.ok ? state.value.project : null;
    const revision = project?.revision;
    let diffValue: ProjectDiff | null | undefined;
    if (shouldIncludeDiff) {
      if (payload?.ifRevision) {
        const diff = this.service.getProjectDiff({
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
  }
}


const attachRenderPreviewContent = (
  response: ToolResponse<RenderPreviewResult>
): ToolResponse<RenderPreviewResult> => {
  if (!response.ok) return response;
  const content = buildRenderPreviewContent(response.data);
  const structuredContent = buildRenderPreviewStructured(response.data);
  if (!content.length) {
    return { ...response, structuredContent };
  }
  return { ...response, content, structuredContent };
};
