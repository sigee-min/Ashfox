import type { TextureUsage } from '../../domain/model';
import { collectTextureTargets } from '../../domain/uvTargets';
import type { ApplyTextureSpecPayload } from '../../spec';
import type { ToolResponse } from '../../types';
import { askUser, callTool, readResource, refTool, refUser } from '../../mcp/nextActions';
import { applyTextureSpecSteps, createApplyReport } from '../apply';
import { createProxyPipeline } from '../pipeline';
import { guardUvForTextureTargets } from '../uvGuard';
import { validateTextureSpec } from '../validators';
import { tryRecoverUvForTextureSpec } from './recovery';
import type { ProxyPipelineDeps } from './types';

export const applyTextureSpecProxy = async (
  deps: ProxyPipelineDeps,
  payload: ApplyTextureSpecPayload
): Promise<ToolResponse<unknown>> => {
  const v = validateTextureSpec(payload, deps.limits);
  if (!v.ok) return v;
  const pipeline = createProxyPipeline({
    service: deps.service,
    payload,
    includeStateByDefault: deps.includeStateByDefault,
    includeDiffByDefault: deps.includeDiffByDefault,
    runWithoutRevisionGuard: (fn) => deps.runWithoutRevisionGuard(fn)
  });
  const guard = pipeline.guardRevision();
  if (guard) return guard;
  const targets = collectTextureTargets(payload.textures);
  const uvGuard = guardUvForTextureTargets(deps.service, pipeline.meta, payload.uvUsageId, targets);
  let usage: TextureUsage | null = null;
  let recovery: Record<string, unknown> | undefined;
  let recoveredUvUsageId: string | undefined;
  if (!uvGuard.ok) {
    const recovered = tryRecoverUvForTextureSpec(deps, payload, pipeline.meta, targets, uvGuard.error);
    if (!recovered) return uvGuard;
    if (!recovered.ok) return recovered;
    usage = recovered.data.usage;
    recovery = recovered.data.recovery;
    recoveredUvUsageId = recovered.data.uvUsageId;
  } else {
    usage = uvGuard.data.usage;
  }
  return pipeline.run(async () => {
    const report = createApplyReport();
    const result = await applyTextureSpecSteps(
      deps.service,
      deps.dom,
      deps.limits,
      payload.textures,
      report,
      pipeline.meta,
      deps.log,
      usage ?? undefined
    );
    if (!result.ok) return result;
    deps.log.info('applyTextureSpec applied', { textures: payload.textures.length });
    const response = pipeline.ok({
      applied: true,
      report,
      ...(recovery
        ? {
            recovery,
            uvUsageId: recoveredUvUsageId
          }
        : {})
    });

    const textureLabels = payload.textures
      .map((t) => t.name ?? t.targetName ?? t.targetId)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    const unique = Array.from(new Set(textureLabels)).slice(0, 5);
    const labelHint = unique.length > 0 ? unique.join(', ') : 'the new texture(s)';

    return {
      ...response,
      nextActions: [
        readResource(
          'bbmcp://guide/texture-workflow',
          'Review the recommended UV-first texture workflow (assign -> preflight -> paint -> preview).',
          1
        ),
        callTool('get_project_state', { detail: 'full' }, 'Get cube names and latest ifRevision for assignment/preview.', 2),
        askUser(
          `Which cubes should use ${labelHint}? (Provide cubeNames or say "all" if safe.)`,
          'assign_texture needs a scope (cubeNames/cubeIds). Avoid clobbering multi-texture models.',
          3
        ),
        callTool(
          'assign_texture',
          {
            textureName: unique[0] ?? refUser('textureName'),
            cubeNames: refUser('cubeNames (or "all" if safe)'),
            ifRevision: refTool('get_project_state', '/project/revision')
          },
          'Bind the texture to cubes so it shows up in preview/export.',
          4
        ),
        callTool(
          'render_preview',
          { mode: 'fixed', output: 'single', angle: [30, 45, 0], ifRevision: refTool('get_project_state', '/project/revision') },
          'Render a preview to validate textures.',
          5
        )
      ]
    };
  });
};
