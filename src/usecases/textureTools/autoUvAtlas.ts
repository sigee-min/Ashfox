import type { AutoUvAtlasPayload, AutoUvAtlasResult, ToolError } from '../../types';
import { buildUvAtlasPlan } from '../../domain/uv/atlas';
import { reprojectTexturePixels } from '../../domain/textureReproject';
import { toDomainSnapshot, toDomainTextureUsage } from '../domainMappers';
import { withActiveOnly } from '../guards';
import { fromDomainResult } from '../fromDomain';
import { fail, ok, type UsecaseResult } from '../result';
import { DEFAULT_UV_POLICY, normalizePixelsPerBlock } from '../../domain/uv/policy';
import type { CubeFaceDirection } from '../../domain/model';
import {
  TEXTURE_AUTO_UV_NO_TEXTURES,
  TEXTURE_AUTO_UV_DENSITY_UPDATE_UNAVAILABLE,
  TEXTURE_AUTO_UV_RESOLUTION_MISSING,
  TEXTURE_AUTO_UV_REPROJECT_UNAVAILABLE,
  TEXTURE_AUTO_UV_SOURCE_MISSING,
  TEXTURE_AUTO_UV_SOURCE_SIZE_MISSING,
  TEXTURE_AUTO_UV_UNRESOLVED_REFS
} from '../../shared/messages';
import type { TextureToolContext } from './context';
import { uvAtlasMessages } from './context';

export const runAutoUvAtlas = (
  ctx: TextureToolContext,
  payload: AutoUvAtlasPayload
): UsecaseResult<AutoUvAtlasResult> => {
  return withActiveOnly<AutoUvAtlasResult>(ctx.ensureActive, () => {
    const apply = payload.apply !== false;
    if (apply) {
      const revisionErr = ctx.ensureRevisionMatch(payload.ifRevision);
      if (revisionErr) return fail(revisionErr);
    }
    const usageRes = ctx.editor.getTextureUsage({});
    if (usageRes.error) return fail(usageRes.error);
    const usageRaw = usageRes.result ?? { textures: [] };
    const usage = toDomainTextureUsage(usageRaw);
    if (usage.textures.length === 0) {
      return fail({ code: 'invalid_state', message: TEXTURE_AUTO_UV_NO_TEXTURES });
    }
    const unresolvedCount = usage.unresolved?.length ?? 0;
    if (unresolvedCount > 0) {
      return fail({
        code: 'invalid_state',
        message: TEXTURE_AUTO_UV_UNRESOLVED_REFS(unresolvedCount)
      });
    }
    const resolution = ctx.editor.getProjectTextureResolution();
    if (!resolution) {
      return fail({
        code: 'invalid_state',
        message: TEXTURE_AUTO_UV_RESOLUTION_MISSING
      });
    }
    const padding =
      typeof payload.padding === 'number' && Number.isFinite(payload.padding)
        ? Math.max(0, Math.trunc(payload.padding))
        : 0;
    const snapshot = ctx.getSnapshot();
    const domainSnapshot = toDomainSnapshot(snapshot);
    const faceKey = (cubeId: string | undefined, cubeName: string, face: string) =>
      `${cubeId ? `id:${cubeId}` : `name:${cubeName}`}::${face}`;
    const basePolicy = ctx.getUvPolicyConfig();
    const maxTextureSize = ctx.capabilities.limits.maxTextureSize;
    const maxEdgeRaw = basePolicy.autoMaxResolution ?? 0;
    const maxEdge = Number.isFinite(maxEdgeRaw) && maxEdgeRaw > 0 ? Math.trunc(maxEdgeRaw) : maxTextureSize;
    const minEdge = Math.max(resolution.width, resolution.height);
    const maxEdgeSafe = Math.min(maxTextureSize, Math.max(maxEdge, minEdge));
    const fallbackPixels = normalizePixelsPerBlock(DEFAULT_UV_POLICY.pixelsPerBlock) ?? 16;
    const basePixels = normalizePixelsPerBlock(basePolicy.pixelsPerBlock, fallbackPixels) ?? fallbackPixels;
    const buildPlan = (pixelsPerBlock: number) =>
      fromDomainResult(
        buildUvAtlasPlan({
          usage,
          cubes: domainSnapshot.cubes,
          resolution,
          maxResolution: { width: maxEdgeSafe, height: maxEdgeSafe },
          padding,
          policy: { ...basePolicy, pixelsPerBlock },
          messages: uvAtlasMessages
        })
      );
    let pixelsPerBlock = basePixels;
    let planRes = buildPlan(pixelsPerBlock);
    if (apply) {
      while (!planRes.ok && shouldReduceDensity(planRes.error) && pixelsPerBlock > 1) {
        const next = reducePixelsPerBlock(pixelsPerBlock);
        if (!next || next === pixelsPerBlock) break;
        pixelsPerBlock = next;
        planRes = buildPlan(pixelsPerBlock);
      }
    }
    if (!planRes.ok) return fail(planRes.error);
    const plan = planRes.value;
    if (!apply) {
      return ok({
        applied: false,
        steps: plan.steps,
        resolution: plan.resolution,
        textures: plan.textures
      });
    }
    if (pixelsPerBlock !== basePixels) {
      if (!ctx.setProjectUvPixelsPerBlock) {
        return fail({ code: 'not_implemented', message: TEXTURE_AUTO_UV_DENSITY_UPDATE_UNAVAILABLE });
      }
      const uvErr = ctx.setProjectUvPixelsPerBlock(pixelsPerBlock);
      if (uvErr) return fail(uvErr);
    }
    if (plan.resolution.width !== resolution.width || plan.resolution.height !== resolution.height) {
      const err = ctx.editor.setProjectTextureResolution(plan.resolution.width, plan.resolution.height, false);
      if (err) return fail(err);
    }
    if (!ctx.textureRenderer?.readPixels) {
      return fail({ code: 'not_implemented', message: TEXTURE_AUTO_UV_REPROJECT_UNAVAILABLE });
    }
    const newRectsByFace = new Map<string, [number, number, number, number]>();
    plan.assignments.forEach((assignment) => {
      newRectsByFace.set(faceKey(assignment.cubeId, assignment.cubeName, assignment.face), assignment.uv);
    });
    for (const texture of usage.textures) {
      const mappings: Array<{ from: [number, number, number, number]; to: [number, number, number, number] }> = [];
      for (const cube of texture.cubes) {
        for (const face of cube.faces) {
          const key = faceKey(cube.id, cube.name, face.face);
          const nextRect = newRectsByFace.get(key);
          const prevRect = face.uv;
          if (!nextRect || !prevRect) continue;
          mappings.push({ from: prevRect, to: nextRect });
        }
      }
      const textureRes = ctx.editor.readTexture({ id: texture.id, name: texture.name });
      if (textureRes.error || !textureRes.result) {
        return fail({
          code: 'invalid_state',
          message: TEXTURE_AUTO_UV_SOURCE_MISSING(texture.name)
        });
      }
      const source = textureRes.result;
      if (!source.image) {
        return fail({
          code: 'invalid_state',
          message: TEXTURE_AUTO_UV_SOURCE_MISSING(texture.name)
        });
      }
      const sourceWidth = source.width ?? texture.width;
      const sourceHeight = source.height ?? texture.height;
      if (!sourceWidth || !sourceHeight) {
        return fail({
          code: 'invalid_state',
          message: TEXTURE_AUTO_UV_SOURCE_SIZE_MISSING(texture.name)
        });
      }
      if (mappings.length === 0) {
        mappings.push({
          from: [0, 0, sourceWidth, sourceHeight],
          to: [0, 0, plan.resolution.width, plan.resolution.height]
        });
      }
      const readRes = ctx.textureRenderer.readPixels({
        image: source.image,
        width: sourceWidth,
        height: sourceHeight
      });
      if (readRes.error || !readRes.result) return fail(readRes.error ?? { code: 'unknown', message: 'read failed' });
      const backup = captureTextureBackup({
        textureRenderer: ctx.textureRenderer,
        image: source.image,
        width: readRes.result.width,
        height: readRes.result.height,
        data: readRes.result.data
      });
      const targetPixels = reprojectTexturePixels({
        source: readRes.result.data,
        sourceWidth: readRes.result.width,
        sourceHeight: readRes.result.height,
        destWidth: plan.resolution.width,
        destHeight: plan.resolution.height,
        mappings
      });
      const renderRes = ctx.textureRenderer.renderPixels({
        width: plan.resolution.width,
        height: plan.resolution.height,
        data: targetPixels
      });
      if (renderRes.error || !renderRes.result) return fail(renderRes.error ?? { code: 'unknown', message: 'render failed' });
      const updateRes = ctx.updateTexture({
        id: source.id ?? texture.id,
        name: source.name ?? texture.name,
        image: renderRes.result.image,
        width: plan.resolution.width,
        height: plan.resolution.height,
        ifRevision: payload.ifRevision
      });
      if (!updateRes.ok && updateRes.error.code !== 'no_change') return fail(updateRes.error);
      if (updateRes.ok) {
        const rollbackError = maybeRollbackTextureLoss({
          ctx,
          textureRenderer: ctx.textureRenderer,
          texture: {
            id: source.id ?? texture.id,
            name: source.name ?? texture.name,
            width: plan.resolution.width,
            height: plan.resolution.height
          },
          ifRevision: payload.ifRevision,
          backup
        });
        if (rollbackError) return fail(rollbackError);
      }
    }
    const updatesByCube = new Map<string, { cubeId?: string; cubeName: string; faces: FaceUvMap }>();
    plan.assignments.forEach((assignment) => {
      const key = assignment.cubeId ? `id:${assignment.cubeId}` : `name:${assignment.cubeName}`;
      const entry = updatesByCube.get(key) ?? {
        cubeId: assignment.cubeId,
        cubeName: assignment.cubeName,
        faces: {}
      };
      entry.faces[assignment.face] = assignment.uv;
      if (!entry.cubeId && assignment.cubeId) entry.cubeId = assignment.cubeId;
      updatesByCube.set(key, entry);
    });
    for (const entry of updatesByCube.values()) {
      const err = ctx.editor.setFaceUv({
        cubeId: entry.cubeId,
        cubeName: entry.cubeName,
        faces: entry.faces
      });
      if (err) return fail(err);
    }
    return ok({
      applied: true,
      steps: plan.steps,
      resolution: plan.resolution,
      textures: plan.textures
    });
  });
};

const shouldReduceDensity = (error: { details?: Record<string, unknown> } | null | undefined): boolean => {
  const reason = typeof error?.details?.reason === 'string' ? error.details.reason : '';
  if (reason === 'atlas_overflow' || reason === 'uv_size_exceeds') return true;
  const details = error?.details ?? {};
  return typeof details.nextWidth === 'number' && typeof details.maxWidth === 'number';
};

const reducePixelsPerBlock = (value: number): number | null => {
  if (!Number.isFinite(value) || value <= 1) return null;
  const current = Math.trunc(value);
  if (current <= 1) return null;
  if (current <= 4) return current - 1;
  return Math.max(1, Math.floor(current * 0.5));
};

type FaceUvMap = Partial<Record<CubeFaceDirection, [number, number, number, number]>>;

type TextureBackup = {
  image: CanvasImageSource;
  width: number;
  height: number;
  opaquePixels: number;
};

const captureTextureBackup = (params: {
  textureRenderer: NonNullable<TextureToolContext['textureRenderer']>;
  image: CanvasImageSource;
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): TextureBackup => {
  const snapshot = new Uint8ClampedArray(params.data);
  const renderRes = params.textureRenderer.renderPixels({
    width: params.width,
    height: params.height,
    data: snapshot
  });
  const backupImage = renderRes.error || !renderRes.result?.image ? params.image : renderRes.result.image;
  return {
    image: backupImage,
    width: params.width,
    height: params.height,
    opaquePixels: countOpaquePixels(snapshot)
  };
};

const maybeRollbackTextureLoss = (params: {
  ctx: TextureToolContext;
  textureRenderer: NonNullable<TextureToolContext['textureRenderer']>;
  texture: { id?: string; name: string; width?: number; height?: number };
  ifRevision?: string;
  backup: TextureBackup | null;
}): ToolError | null => {
  if (!params.backup) return null;
  const readRes = params.ctx.editor.readTexture({ id: params.texture.id, name: params.texture.name });
  if (readRes.error || !readRes.result?.image) return null;
  const width = Number(readRes.result.width ?? params.texture.width ?? params.backup.width);
  const height = Number(readRes.result.height ?? params.texture.height ?? params.backup.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const pixelRes = params.textureRenderer.readPixels?.({
    image: readRes.result.image,
    width,
    height
  });
  if (!pixelRes || pixelRes.error || !pixelRes.result) return null;
  const currentOpaque = countOpaquePixels(pixelRes.result.data);
  if (!isSuspiciousOpaqueDrop(params.backup.opaquePixels, currentOpaque)) return null;
  const rollbackRes = params.ctx.updateTexture({
    id: params.texture.id,
    name: params.texture.name,
    image: params.backup.image,
    width: params.backup.width,
    height: params.backup.height,
    ifRevision: params.ifRevision
  });
  if (!rollbackRes.ok && rollbackRes.error.code !== 'no_change') return rollbackRes.error;
  return {
    code: 'invalid_state',
    message: 'auto_uv_atlas reproject produced severe texture loss; texture was rolled back.',
    details: {
      reason: 'texture_recovery_guard',
      context: 'auto_uv_atlas',
      beforeOpaquePixels: params.backup.opaquePixels,
      afterOpaquePixels: currentOpaque
    }
  };
};

const countOpaquePixels = (data: Uint8ClampedArray): number => {
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 8) count += 1;
  }
  return count;
};

const isSuspiciousOpaqueDrop = (beforeOpaquePixels: number, afterOpaquePixels: number): boolean => {
  if (!Number.isFinite(beforeOpaquePixels) || !Number.isFinite(afterOpaquePixels)) return false;
  if (beforeOpaquePixels < 256) return false;
  if (afterOpaquePixels >= beforeOpaquePixels) return false;
  const minAllowed = Math.max(64, Math.floor(beforeOpaquePixels * 0.05));
  return afterOpaquePixels < minAllowed;
};

