import type { ToolResponse } from '../types';
import { guardUvOverlaps, guardUvScale, guardUvUsageId } from '../domain/uvGuards';
import type { TextureTargetSet } from '../domain/uvTargets';
import type { Cube, TextureUsage } from '../domain/model';
import type { UvPolicyConfig } from '../domain/uvPolicy';
import { requireUvUsageId } from '../domain/uvUsageId';
import { toDomainCube, toDomainTextureUsage } from '../usecases/domainMappers';
import type { ToolService } from '../usecases/ToolService';
import type { MetaOptions } from './meta';
import { withErrorMeta } from './meta';

export type UvGuardResult = { usage: TextureUsage };

export type UvGuardContext = {
  usage: TextureUsage;
  targets: TextureTargetSet;
  cubes: Cube[];
  resolution?: { width: number; height: number };
  policy: UvPolicyConfig;
};

export const guardUvForUsage = (
  service: ToolService,
  meta: MetaOptions,
  context: UvGuardContext
): ToolResponse<UvGuardResult> => {
  const overlapError = guardUvOverlaps(context.usage, context.targets);
  if (overlapError) return withErrorMeta(overlapError, meta, service);
  const scaleError = guardUvScale({
    usage: context.usage,
    cubes: context.cubes,
    resolution: context.resolution,
    policy: context.policy,
    targets: context.targets
  });
  if (scaleError) return withErrorMeta(scaleError, meta, service);
  return { ok: true, data: { usage: context.usage } };
};

export const guardUvForTextureTargets = (
  service: ToolService,
  meta: MetaOptions,
  uvUsageId: string | undefined,
  targets: TextureTargetSet
): ToolResponse<UvGuardResult> => {
  const usageRes = service.getTextureUsage({});
  if (!usageRes.ok) return withErrorMeta(usageRes.error, meta, service);
  const usage = toDomainTextureUsage(usageRes.value);
  const usageIdRes = requireUvUsageId(uvUsageId);
  if (!usageIdRes.ok) return withErrorMeta(usageIdRes.error, meta, service);
  const usageIdError = guardUvUsageId(usage, usageIdRes.data);
  if (usageIdError) return withErrorMeta(usageIdError, meta, service);
  const stateRes = service.getProjectState({ detail: 'full' });
  if (!stateRes.ok) return withErrorMeta(stateRes.error, meta, service);
  const project = stateRes.value.project;
  return guardUvForUsage(service, meta, {
    usage,
    targets,
    cubes: (project.cubes ?? []).map((cube) => toDomainCube(cube)),
    resolution: project.textureResolution,
    policy: service.getUvPolicy()
  });
};
