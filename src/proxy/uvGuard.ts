import type { ToolResponse } from '../types';
import { guardUvOverlaps, guardUvScale, guardUvUsageId } from '../domain/uvGuards';
import type { TextureTargetSet } from '../domain/uvTargets';
import type { TextureUsage } from '../domain/model';
import { toDomainCube, toDomainTextureUsage } from '../usecases/domainMappers';
import type { ToolService } from '../usecases/ToolService';
import type { MetaOptions } from './meta';
import { withErrorMeta } from './meta';

export type UvGuardResult = { usage: TextureUsage };

export const guardUvForTextureTargets = (
  service: ToolService,
  meta: MetaOptions,
  uvUsageId: string,
  targets: TextureTargetSet
): ToolResponse<UvGuardResult> => {
  const usageRes = service.getTextureUsage({});
  if (!usageRes.ok) return withErrorMeta(usageRes.error, meta, service);
  const usage = toDomainTextureUsage(usageRes.value);
  const usageIdError = guardUvUsageId(usage, uvUsageId);
  if (usageIdError) return withErrorMeta(usageIdError, meta, service);
  const overlapError = guardUvOverlaps(usage, targets);
  if (overlapError) return withErrorMeta(overlapError, meta, service);
  const stateRes = service.getProjectState({ detail: 'full' });
  if (!stateRes.ok) return withErrorMeta(stateRes.error, meta, service);
  const project = stateRes.value.project;
  const scaleError = guardUvScale({
    usage,
    cubes: (project.cubes ?? []).map((cube) => toDomainCube(cube)),
    resolution: project.textureResolution,
    policy: service.getUvPolicy(),
    targets
  });
  if (scaleError) return withErrorMeta(scaleError, meta, service);
  return { ok: true, data: { usage } };
};
