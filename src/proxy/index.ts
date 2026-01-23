import { Logger } from '../logging';
import { Limits, RenderPreviewPayload, RenderPreviewResult, ToolResponse } from '../types';
import {
  ApplyEntitySpecPayload,
  ApplyModelSpecPayload,
  ApplyTextureSpecPayload,
  ApplyUvSpecPayload,
  ProxyTool
} from '../spec';
import { ToolService } from '../usecases/ToolService';
import { buildRenderPreviewContent, buildRenderPreviewStructured } from '../mcp/content';
import { applyModelSpecSteps, applyTextureSpecSteps, createApplyReport } from './apply';
import { withErrorMeta } from './meta';
import { toToolResponse } from './response';
import { validateEntitySpec, validateModelSpec, validateTextureSpec, validateUvSpec } from './validators';
import { computeTextureUsageId } from '../domain/textureUsage';
import { guardUvOverlaps, guardUvScale, guardUvUsageId } from '../domain/uvGuards';
import { collectTextureTargets } from '../domain/uvTargets';
import { toDomainCube, toDomainTextureUsage } from '../usecases/domainMappers';
import { buildUvApplyPlan } from '../domain/uvApply';
import { guardUvForTextureTargets } from './uvGuard';
import { createProxyPipeline } from './pipeline';

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
    const v = validateTextureSpec(payload, this.limits);
    if (!v.ok) return v;
    const pipeline = createProxyPipeline({
      service: this.service,
      payload,
      includeStateByDefault: this.includeStateByDefault,
      includeDiffByDefault: this.includeDiffByDefault,
      runWithoutRevisionGuard: (fn) => this.runWithoutRevisionGuard(fn)
    });
    const guard = pipeline.guardRevision();
    if (guard) return guard;
    const targets = collectTextureTargets(payload.textures);
    const uvGuard = guardUvForTextureTargets(this.service, pipeline.meta, payload.uvUsageId, targets);
    if (!uvGuard.ok) return uvGuard;
    const usage = uvGuard.data.usage;
    return pipeline.run(async () => {
      const report = createApplyReport();
      const result = await applyTextureSpecSteps(
        this.service,
        this.limits,
        payload.textures,
        report,
        pipeline.meta,
        this.log,
        usage
      );
      if (!result.ok) return result;
      this.log.info('applyTextureSpec applied', { textures: payload.textures.length });
      return pipeline.ok({ applied: true, report });
    });
  }

  async applyUvSpec(payload: ApplyUvSpecPayload): Promise<ToolResponse<unknown>> {
    const v = validateUvSpec(payload);
    if (!v.ok) return v;
    const pipeline = createProxyPipeline({
      service: this.service,
      payload,
      includeStateByDefault: this.includeStateByDefault,
      includeDiffByDefault: this.includeDiffByDefault,
      runWithoutRevisionGuard: (fn) => this.runWithoutRevisionGuard(fn)
    });
    const guard = pipeline.guardRevision();
    if (guard) return guard;
    return pipeline.run(async () => {
      const usageRes = this.service.getTextureUsage({});
      if (!usageRes.ok) return withErrorMeta(usageRes.error, pipeline.meta, this.service);
      const usage = toDomainTextureUsage(usageRes.value);
      const usageIdError = guardUvUsageId(usage, payload.uvUsageId);
      if (usageIdError) {
        return withErrorMeta(usageIdError, pipeline.meta, this.service);
      }
      const stateRes = this.service.getProjectState({ detail: 'full' });
      if (!stateRes.ok) return withErrorMeta(stateRes.error, pipeline.meta, this.service);
      const project = stateRes.value.project;
      const planRes = buildUvApplyPlan(
        usage,
        (project.cubes ?? []).map((cube) => toDomainCube(cube)),
        payload.assignments,
        project.textureResolution
      );
      if (!planRes.ok) return withErrorMeta(planRes.error, pipeline.meta, this.service);

      const targets = collectTextureTargets(planRes.data.touchedTextures);
      const overlapError = guardUvOverlaps(planRes.data.usage, targets);
      if (overlapError) return withErrorMeta(overlapError, pipeline.meta, this.service);

      const scaleError = guardUvScale({
        usage: planRes.data.usage,
        cubes: (project.cubes ?? []).map((cube) => toDomainCube(cube)),
        resolution: project.textureResolution,
        policy: this.service.getUvPolicy(),
        targets
      });
      if (scaleError) return withErrorMeta(scaleError, pipeline.meta, this.service);

      for (const update of planRes.data.updates) {
        const res = this.service.setFaceUv({
          cubeId: update.cubeId,
          cubeName: update.cubeName,
          faces: update.faces,
          ifRevision: payload.ifRevision
        });
        if (!res.ok) return withErrorMeta(res.error, pipeline.meta, this.service);
      }
      const nextUsageId = computeTextureUsageId(planRes.data.usage);
      const result = {
        applied: true,
        cubes: planRes.data.cubeCount,
        faces: planRes.data.faceCount,
        uvUsageId: nextUsageId
      };
      return pipeline.ok(result);
    });
  }

  async applyEntitySpec(payload: ApplyEntitySpecPayload): Promise<ToolResponse<unknown>> {
    const v = validateEntitySpec(payload, this.limits);
    if (!v.ok) return v;
    if (payload.format !== 'geckolib') {
      return { ok: false, error: { code: 'not_implemented', message: `Format not implemented: ${payload.format}` } };
    }
    const pipeline = createProxyPipeline({
      service: this.service,
      payload,
      includeStateByDefault: this.includeStateByDefault,
      includeDiffByDefault: this.includeDiffByDefault,
      runWithoutRevisionGuard: (fn) => this.runWithoutRevisionGuard(fn)
    });
    const guard = pipeline.guardRevision();
    if (guard) return guard;
    return pipeline.run(async () => {
      const result: Record<string, unknown> = {
        format: payload.format,
        targetVersion: payload.targetVersion ?? 'v4'
      };
      if (payload.ensureProject) {
        const options = typeof payload.ensureProject === 'object' ? payload.ensureProject : {};
        const ensure = this.service.ensureProject({
          format: 'geckolib',
          name: options.name,
          match: options.match ?? 'format',
          onMismatch: options.onMismatch ?? 'reuse',
          onMissing: options.onMissing ?? 'create',
          confirmDiscard: options.confirmDiscard,
          confirmDialog: options.confirmDialog,
          dialog: options.dialog,
          ifRevision: payload.ifRevision
        });
        if (!ensure.ok) return withErrorMeta(ensure.error, pipeline.meta, this.service);
        result.project = ensure.value;
      }
      const stateCheck = this.service.getProjectState({ detail: 'summary' });
      if (!stateCheck.ok) return withErrorMeta(stateCheck.error, pipeline.meta, this.service);
      if (stateCheck.value.project.format !== 'geckolib') {
        return withErrorMeta(
          {
            code: 'invalid_state',
            message: 'Active project format must be geckolib for apply_entity_spec.',
            fix: 'Call apply_entity_spec with ensureProject or switch to a geckolib project.'
          },
          pipeline.meta,
          this.service
        );
      }
      if (payload.model) {
        const report = createApplyReport();
        const modelRes = applyModelSpecSteps(
          this.service,
          this.log,
          { model: payload.model, ifRevision: payload.ifRevision },
          report,
          pipeline.meta
        );
        if (!modelRes.ok) return modelRes;
        result.model = { applied: true, report };
      }
      if (payload.textures && payload.textures.length > 0) {
        if (!payload.uvUsageId) {
          return withErrorMeta(
            { code: 'invalid_payload', message: 'uvUsageId is required when textures are provided' },
            pipeline.meta,
            this.service
          );
        }
        const targets = collectTextureTargets(payload.textures);
        const uvGuard = guardUvForTextureTargets(this.service, pipeline.meta, payload.uvUsageId, targets);
        if (!uvGuard.ok) return uvGuard;
        const usage = uvGuard.data.usage;
        const report = createApplyReport();
        const textureRes = await applyTextureSpecSteps(
          this.service,
          this.limits,
          payload.textures,
          report,
          pipeline.meta,
          this.log,
          usage
        );
        if (!textureRes.ok) return textureRes;
        result.textures = { applied: true, report };
      }
      if (payload.animations && payload.animations.length > 0) {
        const stateRes = this.service.getProjectState({ detail: 'full' });
        if (!stateRes.ok) return withErrorMeta(stateRes.error, pipeline.meta, this.service);
        const existing = new Set((stateRes.value.project.animations ?? []).map((anim) => anim.name));
        const applied: string[] = [];
        let keyframeCount = 0;
        for (const anim of payload.animations) {
          const mode = anim.mode ?? (existing.has(anim.name) ? 'update' : 'create');
          if (mode === 'create') {
            const createRes = this.service.createAnimationClip({
              name: anim.name,
              length: anim.length,
              loop: anim.loop,
              fps: anim.fps ?? 20,
              ifRevision: payload.ifRevision
            });
            if (!createRes.ok) return withErrorMeta(createRes.error, pipeline.meta, this.service);
          } else {
            const updateRes = this.service.updateAnimationClip({
              name: anim.name,
              length: anim.length,
              loop: anim.loop,
              fps: anim.fps,
              ifRevision: payload.ifRevision
            });
            if (!updateRes.ok) return withErrorMeta(updateRes.error, pipeline.meta, this.service);
          }
          applied.push(anim.name);
          if (anim.channels) {
            for (const channel of anim.channels) {
              keyframeCount += channel.keys.length;
              const keyRes = this.service.setKeyframes({
                clip: anim.name,
                bone: channel.bone,
                channel: channel.channel,
                keys: channel.keys,
                ifRevision: payload.ifRevision
              });
              if (!keyRes.ok) return withErrorMeta(keyRes.error, pipeline.meta, this.service);
            }
          }
          if (anim.triggers) {
            for (const trigger of anim.triggers) {
              keyframeCount += trigger.keys.length;
              const triggerRes = this.service.setTriggerKeyframes({
                clip: anim.name,
                channel: trigger.type,
                keys: trigger.keys,
                ifRevision: payload.ifRevision
              });
              if (!triggerRes.ok) return withErrorMeta(triggerRes.error, pipeline.meta, this.service);
            }
          }
        }
        result.animations = { applied: true, clips: applied, keyframes: keyframeCount };
      }
      return pipeline.ok(result);
    });
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
        case 'apply_entity_spec':
          return await this.applyEntitySpec(payload as ApplyEntitySpecPayload);
        case 'render_preview':
          return attachRenderPreviewContent(
            toToolResponse(this.service.renderPreview(payload as RenderPreviewPayload))
          );
        case 'validate':
          return toToolResponse(this.service.validate());
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
