import type { PaintFacesPayload, PaintFacesResult, ToolError } from '../../types';
import type { TextureUsageResult } from '../../types/textureUsage';
import { applyTextureOps, parseHexColor } from '../../domain/texturePaint';
import { isTextureOp } from '../../domain/textureOps';
import type { TextureOpLike } from '../../domain/textureOps';
import { applyUvPaintPixels } from '../../domain/uv/paintPixels';
import { resolveUvPaintRects } from '../../domain/uv/paint';
import { validateUvPaintSpec } from '../../domain/uv/paintValidation';
import { guardUvUsage } from '../../domain/uv/guards';
import { collectSingleTarget } from '../../domain/uv/targets';
import { checkDimensions, mapDimensionError } from '../../domain/dimensions';
import { toDomainSnapshot, toDomainTextureUsage } from '../domainMappers';
import { buildIdNameMismatchMessage } from '../../shared/targetMessages';
import { normalizeCubeFaces } from '../textureService/textureUsageUtils';
import {
  DIMENSION_INTEGER_MESSAGE,
  DIMENSION_POSITIVE_MESSAGE,
  TEXTURE_ASSIGN_FACES_INVALID,
  TEXTURE_FACES_FACE_REQUIRED,
  TEXTURE_FACES_OP_REQUIRED,
  TEXTURE_FACES_OP_OUTSIDE_SOURCE,
  TEXTURE_FACES_OP_OUTSIDE_TARGET,
  TEXTURE_FACES_COORD_SPACE_INVALID,
  TEXTURE_FACES_TEXTURE_COORDS_SIZE_REQUIRED,
  TEXTURE_FACES_TEXTURE_COORDS_SIZE_MISMATCH,
  TEXTURE_FACES_SIZE_REQUIRED,
  TEXTURE_FACES_TARGET_SELECTOR_REQUIRED,
  TEXTURE_FACES_TARGET_REQUIRED,
  TEXTURE_FACES_TEXTURE_REQUIRED,
  TEXTURE_OP_COLOR_INVALID,
  TEXTURE_OP_INVALID,
  TEXTURE_OP_LINEWIDTH_INVALID,
  TEXTURE_PAINT_SIZE_EXCEEDS_MAX,
  TEXTURE_PAINT_SIZE_EXCEEDS_MAX_FIX,
  TEXTURE_RENDERER_UNAVAILABLE,
  TEXTURE_RENDERER_NO_IMAGE
} from '../../shared/messages';
import { ensureNonBlankString } from '../../shared/payloadValidation';
import { fail, ok, type UsecaseResult } from '../result';
import type { TextureToolContext } from './context';
import { uvGuardMessages, uvPaintMessages, uvPaintPixelMessages, uvPaintSourceMessages } from './context';
import { validateUvPaintSourceSize } from '../../domain/uv/paintSource';
import type { UvPaintSpec } from '../../domain/uv/paintSpec';

type NormalizedTarget = {
  cubeId?: string;
  cubeName?: string;
  face: NonNullable<ReturnType<typeof normalizeCubeFaces>>[number];
};

type TextureBackup = {
  image: CanvasImageSource;
  width: number;
  height: number;
  opaquePixels: number;
};

export const runPaintFaces = (
  ctx: TextureToolContext,
  payload: PaintFacesPayload
): UsecaseResult<PaintFacesResult> => {
  if (!ctx.textureRenderer) {
    return fail({ code: 'not_implemented', message: TEXTURE_RENDERER_UNAVAILABLE });
  }
  const textureRenderer = ctx.textureRenderer;
  const activeErr = ctx.ensureActive();
  if (activeErr) return fail(activeErr);
  const revisionErr = ctx.ensureRevisionMatch(payload.ifRevision);
  if (revisionErr) return fail(revisionErr);

  if (!payload.target || typeof payload.target !== 'object') {
    return fail({ code: 'invalid_payload', message: TEXTURE_FACES_TARGET_REQUIRED });
  }
  const target = payload.target;
  const idBlankErr = ensureNonBlankString(target.cubeId, 'cubeId');
  if (idBlankErr) return fail(idBlankErr);
  const nameBlankErr = ensureNonBlankString(target.cubeName, 'cubeName');
  if (nameBlankErr) return fail(nameBlankErr);
  if (!target.cubeId && !target.cubeName) {
    return fail({ code: 'invalid_payload', message: TEXTURE_FACES_TARGET_SELECTOR_REQUIRED });
  }
  if (target.face === undefined) {
    return fail({ code: 'invalid_payload', message: TEXTURE_FACES_FACE_REQUIRED });
  }
  const faces = normalizeCubeFaces([target.face]);
  if (!faces || faces.length !== 1) {
    return fail({ code: 'invalid_payload', message: TEXTURE_ASSIGN_FACES_INVALID });
  }
  const normalizedTarget: NormalizedTarget = {
    cubeId: target.cubeId,
    cubeName: target.cubeName,
    face: faces[0]
  };

  if (!payload.op || typeof payload.op !== 'object') {
    return fail({ code: 'invalid_payload', message: TEXTURE_FACES_OP_REQUIRED });
  }
  const coordSpace = payload.coordSpace ?? 'face';
  if (coordSpace !== 'face' && coordSpace !== 'texture') {
    return fail({ code: 'invalid_payload', message: TEXTURE_FACES_COORD_SPACE_INVALID });
  }

  const snapshot = ctx.getSnapshot();
  const defaultTextureName = snapshot.name ?? undefined;
  const textureName = payload.textureName ?? defaultTextureName ?? undefined;
  const textureId = payload.textureId;
  if (!textureName && !textureId) {
    return fail({ code: 'invalid_payload', message: TEXTURE_FACES_TEXTURE_REQUIRED });
  }

  const runner = ctx.runWithoutRevisionGuard ?? ((fn: () => UsecaseResult<PaintFacesResult>) => fn());
  return runner(() => {
    const textures = snapshot.textures;
    const byId = textureId ? textures.find((tex) => tex.id === textureId) : undefined;
    const byName = textureName ? textures.find((tex) => tex.name === textureName) : undefined;
    if (byId && byName && byId.name !== byName.name) {
      return fail({
        code: 'invalid_payload',
        message: buildIdNameMismatchMessage({
          kind: 'Texture',
          plural: 'textures',
          idLabel: 'textureId',
          nameLabel: 'textureName',
          id: textureId!,
          name: textureName!
        })
      });
    }
    let resolvedTexture = byId ?? byName ?? null;
    if (!resolvedTexture) {
      if (!ctx.createBlankTexture) {
        return fail({ code: 'not_implemented', message: TEXTURE_RENDERER_UNAVAILABLE });
      }
      const fallbackResolution = ctx.editor.getProjectTextureResolution() ?? { width: 16, height: 16 };
      const createWidth = Number(payload.width ?? fallbackResolution.width);
      const createHeight = Number(payload.height ?? fallbackResolution.height);
      const maxSize = ctx.capabilities.limits.maxTextureSize;
      const sizeCheck = checkDimensions(createWidth, createHeight, { requireInteger: true, maxSize });
      if (!sizeCheck.ok) {
        const sizeMessage = mapDimensionError(sizeCheck, {
          nonPositive: (axis) => DIMENSION_POSITIVE_MESSAGE(axis, axis),
          nonInteger: (axis) => DIMENSION_INTEGER_MESSAGE(axis, axis),
          exceedsMax: (limit) => TEXTURE_PAINT_SIZE_EXCEEDS_MAX(limit || maxSize)
        });
        if (sizeCheck.reason === 'exceeds_max') {
          return fail({
            code: 'invalid_payload',
            message: sizeMessage ?? TEXTURE_PAINT_SIZE_EXCEEDS_MAX(maxSize),
            fix: TEXTURE_PAINT_SIZE_EXCEEDS_MAX_FIX(maxSize),
            details: { width: createWidth, height: createHeight, maxSize }
          });
        }
        return fail({ code: 'invalid_payload', message: sizeMessage ?? DIMENSION_POSITIVE_MESSAGE('width/height') });
      }
      const created = ctx.createBlankTexture({
        name: textureName ?? 'texture',
        width: createWidth,
        height: createHeight,
        allowExisting: true
      });
      if (!created.ok) return fail(created.error);
      const refreshed = ctx.getSnapshot();
      const refreshedById = textureId ? refreshed.textures.find((tex) => tex.id === textureId) : undefined;
      const refreshedByName = textureName ? refreshed.textures.find((tex) => tex.name === textureName) : undefined;
      resolvedTexture = refreshedById ?? refreshedByName ?? null;
    }
    if (!resolvedTexture) {
      return fail({ code: 'invalid_payload', message: TEXTURE_FACES_TEXTURE_REQUIRED });
    }

    const backup = captureTextureBackup(ctx, textureRenderer, {
      id: resolvedTexture.id,
      name: resolvedTexture.name,
      width: resolvedTexture.width,
      height: resolvedTexture.height
    });

    if (ctx.assignTexture) {
      const assignRes = ctx.assignTexture({
        textureId: resolvedTexture.id ?? textureId,
        textureName: resolvedTexture.name,
        cubeIds: normalizedTarget.cubeId ? [normalizedTarget.cubeId] : undefined,
        cubeNames: normalizedTarget.cubeName ? [normalizedTarget.cubeName] : undefined,
        faces: [normalizedTarget.face],
        ifRevision: payload.ifRevision
      });
      if (!assignRes.ok) return fail(assignRes.error);
    }

    const refreshUsage = (): UsecaseResult<{
      uvUsageId?: string;
      usageRaw: TextureUsageResult;
      warningCodes: string[];
    }> => {
      const preflight = ctx.preflightTexture ? ctx.preflightTexture({ includeUsage: true }) : null;
      if (preflight && !preflight.ok) return fail(preflight.error);
      const uvUsageId = preflight?.value.uvUsageId;
      let usageRaw = preflight?.value.textureUsage;
      const warningCodes = preflight?.value.warningCodes ?? [];
      if (!usageRaw) {
        const usageRes = ctx.editor.getTextureUsage({});
        if (usageRes.error) return fail(usageRes.error);
        usageRaw = usageRes.result ?? { textures: [] };
      }
      return ok({ uvUsageId, usageRaw, warningCodes });
    };

    let uvUsageId: string | undefined;
    let usageRaw: TextureUsageResult | undefined;
    let warningCodes: string[] = [];
    const recoveryAttempts: NonNullable<PaintFacesResult['recovery']>['attempts'] = [];
    const policy = ctx.getUvPolicyConfig();
    const maxRecoveriesRaw = policy.autoMaxRetries ?? 1;
    const maxRecoveries = Number.isFinite(maxRecoveriesRaw) ? Math.max(0, Math.trunc(maxRecoveriesRaw)) : 1;

    const maybeRecover = (reason: string): UsecaseResult<void> => {
      if (!ctx.autoUvAtlas) return ok(undefined);
      if (recoveryAttempts.length >= maxRecoveries) return ok(undefined);
      const beforeResolution = ctx.editor.getProjectTextureResolution() ?? undefined;
      const atlasRes = ctx.autoUvAtlas({ apply: true, ifRevision: payload.ifRevision });
      if (!atlasRes.ok) return fail(atlasRes.error);
      recoveryAttempts.push({
        reason,
        steps: atlasRes.value.steps,
        before: beforeResolution,
        after: atlasRes.value.resolution
      });
      const refreshed = refreshUsage();
      if (!refreshed.ok) return fail(refreshed.error);
      uvUsageId = refreshed.value.uvUsageId ?? uvUsageId;
      usageRaw = refreshed.value.usageRaw ?? usageRaw;
      warningCodes = refreshed.value.warningCodes ?? warningCodes;
      return ok(undefined);
    };

    const shouldRecover = (error: ToolError): boolean => {
      const reason = typeof error.details?.reason === 'string' ? error.details.reason : '';
      return [
        'uv_usage_mismatch',
        'uv_overlap',
        'uv_scale_mismatch',
        'rect_outside_bounds',
        'no_rects',
        'no_bounds',
        'usage_missing'
      ].includes(reason);
    };

    const initial = refreshUsage();
    if (!initial.ok) return fail(initial.error);
    uvUsageId = initial.value.uvUsageId;
    usageRaw = initial.value.usageRaw;
    warningCodes = initial.value.warningCodes;

    const recoveryWarning = warningCodes.find((code) =>
      ['uv_no_rects', 'uv_overlap', 'uv_scale_mismatch', 'uv_unresolved_refs', 'uv_bounds_exceed'].includes(code)
    );
    if (recoveryWarning) {
      const recoverRes = maybeRecover(recoveryWarning);
      if (!recoverRes.ok) return fail(recoverRes.error);
    }

    const paintOnce = (): UsecaseResult<PaintFacesResult> => {
      const usage = toDomainTextureUsage(usageRaw ?? { textures: [] });
      const domainSnapshot = toDomainSnapshot(ctx.getSnapshot());
      const textureResolution = ctx.editor.getProjectTextureResolution() ?? undefined;
      if (uvUsageId) {
        const guardErr = guardUvUsage({
          usage,
          cubes: domainSnapshot.cubes,
          expectedUsageId: uvUsageId,
          resolution: textureResolution,
          policy: ctx.getUvPolicyConfig(),
          targets: collectSingleTarget({ id: resolvedTexture.id, name: resolvedTexture.name }),
          messages: uvGuardMessages
        });
        if (guardErr) return fail(guardErr);
      }

      const textureReadRes = ctx.editor.readTexture({ id: resolvedTexture.id, name: resolvedTexture.name });
      if (textureReadRes.error || !textureReadRes.result || !textureReadRes.result.image) {
        return fail(textureReadRes.error ?? { code: 'invalid_state', message: TEXTURE_RENDERER_NO_IMAGE });
      }
      const textureWidth = textureReadRes.result.width ?? resolvedTexture.width ?? textureResolution?.width ?? undefined;
      const textureHeight = textureReadRes.result.height ?? resolvedTexture.height ?? textureResolution?.height ?? undefined;
      if (!textureWidth || !textureHeight) {
        return fail({ code: 'invalid_payload', message: TEXTURE_FACES_SIZE_REQUIRED });
      }

      if (!isTextureOp(payload.op)) {
        return fail({ code: 'invalid_payload', message: TEXTURE_OP_INVALID(resolvedTexture.name) });
      }
      const mapping = payload.mapping ?? 'stretch';
      const uvPaintTarget: UvPaintSpec = {
        scope: 'rects',
        mapping,
        target: {
          cubeIds: normalizedTarget.cubeId ? [normalizedTarget.cubeId] : undefined,
          cubeNames: normalizedTarget.cubeName ? [normalizedTarget.cubeName] : undefined,
          faces: [normalizedTarget.face]
        }
      };
      const targetValidation = validateUvPaintSpec(
        uvPaintTarget,
        ctx.capabilities.limits,
        resolvedTexture.name,
        uvPaintMessages
      );
      if (!targetValidation.ok) return fail(targetValidation.error);
      const rectRes = resolveUvPaintRects(
        { id: resolvedTexture.id, name: resolvedTexture.name, uvPaint: uvPaintTarget },
        usage,
        uvPaintMessages
      );
      if (!rectRes.ok) return fail(rectRes.error);
      const faceBounds = mergeRects(rectRes.data.rects);
      if (!faceBounds) {
        return fail({
          code: 'invalid_state',
          message: uvPaintMessages.noBounds(resolvedTexture.name),
          details: { reason: 'no_bounds' }
        });
      }
      const faceSourceWidth = getRectSpan(faceBounds.x1, faceBounds.x2);
      const faceSourceHeight = getRectSpan(faceBounds.y1, faceBounds.y2);
      let sourceWidth = Number(payload.width ?? faceSourceWidth);
      let sourceHeight = Number(payload.height ?? faceSourceHeight);
      if (coordSpace === 'texture' && (payload.width === undefined || payload.height === undefined)) {
        return fail({ code: 'invalid_payload', message: TEXTURE_FACES_TEXTURE_COORDS_SIZE_REQUIRED });
      }
      const sourceRes = validateUvPaintSourceSize(
        sourceWidth,
        sourceHeight,
        ctx.capabilities.limits,
        resolvedTexture.name,
        { requireInteger: true },
        uvPaintSourceMessages
      );
      if (!sourceRes.ok) {
        const reason = sourceRes.error.details?.reason;
        if (reason === 'exceeds_max') {
          return fail({
            ...sourceRes.error,
            fix: `Use width/height <= ${ctx.capabilities.limits.maxTextureSize}.`,
            details: { ...(sourceRes.error.details ?? {}), maxSize: ctx.capabilities.limits.maxTextureSize }
          });
        }
        return fail(sourceRes.error);
      }
      sourceWidth = Math.trunc(sourceWidth);
      sourceHeight = Math.trunc(sourceHeight);
      if (coordSpace === 'texture' && (sourceWidth !== textureWidth || sourceHeight !== textureHeight)) {
        return fail({
          code: 'invalid_payload',
          message: TEXTURE_FACES_TEXTURE_COORDS_SIZE_MISMATCH(textureWidth, textureHeight, sourceWidth, sourceHeight)
        });
      }
      const opBounds = getTextureOpBounds(payload.op);
      if (!doesBoundsIntersectCanvas(opBounds, sourceWidth, sourceHeight)) {
        return fail({
          code: 'invalid_payload',
          message: TEXTURE_FACES_OP_OUTSIDE_SOURCE(coordSpace, sourceWidth, sourceHeight),
          details: { coordSpace, sourceWidth, sourceHeight, opBounds }
        });
      }
      if (coordSpace === 'texture' && !doesBoundsIntersectRects(opBounds, rectRes.data.rects)) {
        return fail({
          code: 'invalid_payload',
          message: TEXTURE_FACES_OP_OUTSIDE_TARGET,
          details: {
            coordSpace,
            opBounds,
            faceUv: [faceBounds.x1, faceBounds.y1, faceBounds.x2, faceBounds.y2]
          }
        });
      }

      const readPixels = textureRenderer.readPixels?.({
        image: textureReadRes.result.image,
        width: textureWidth,
        height: textureHeight
      });
      if (!readPixels || readPixels.error || !readPixels.result) {
        return fail(readPixels?.error ?? { code: 'not_implemented', message: TEXTURE_RENDERER_UNAVAILABLE });
      }

      const basePixels = new Uint8ClampedArray(readPixels.result.data);
      const beforePixels = new Uint8ClampedArray(basePixels);
      if (coordSpace === 'texture') {
        const textureSpace = new Uint8ClampedArray(basePixels);
        const res = applyTextureOps(textureSpace, sourceWidth, sourceHeight, [payload.op], parseHexColor);
        if (!res.ok) {
          const reason =
            res.reason === 'invalid_line_width'
              ? TEXTURE_OP_LINEWIDTH_INVALID(resolvedTexture.name)
              : TEXTURE_OP_COLOR_INVALID(resolvedTexture.name);
          return fail({ code: 'invalid_payload', message: reason, details: { opIndex: res.opIndex } });
        }
        overlayTextureSpaceRects(basePixels, textureSpace, rectRes.data.rects, textureWidth, textureHeight);
      } else {
        const sourceData = new Uint8ClampedArray(sourceWidth * sourceHeight * 4);
        const res = applyTextureOps(sourceData, sourceWidth, sourceHeight, [payload.op], parseHexColor);
        if (!res.ok) {
          const reason =
            res.reason === 'invalid_line_width'
              ? TEXTURE_OP_LINEWIDTH_INVALID(resolvedTexture.name)
              : TEXTURE_OP_COLOR_INVALID(resolvedTexture.name);
          return fail({ code: 'invalid_payload', message: reason, details: { opIndex: res.opIndex } });
        }
        const uvPaint: UvPaintSpec = {
          ...uvPaintTarget,
          source: { width: sourceWidth, height: sourceHeight }
        };
        const uvPaintValidation = validateUvPaintSpec(
          uvPaint,
          ctx.capabilities.limits,
          resolvedTexture.name,
          uvPaintMessages
        );
        if (!uvPaintValidation.ok) return fail(uvPaintValidation.error);
        const patchRes = applyUvPaintPixels({
          source: { width: sourceWidth, height: sourceHeight, data: sourceData },
          target: { width: textureWidth, height: textureHeight },
          config: { rects: rectRes.data.rects, mapping, padding: 0, anchor: [0, 0] },
          label: resolvedTexture.name,
          messages: uvPaintPixelMessages
        });
        if (!patchRes.ok) return fail(patchRes.error);
        overlayPatchRects(basePixels, patchRes.data.data, patchRes.data.rects, textureWidth, textureHeight);
      }
      const changedPixels = countChangedPixels(beforePixels, basePixels);

      const renderRes = textureRenderer.renderPixels({
        width: textureWidth,
        height: textureHeight,
        data: basePixels
      });
      if (renderRes.error) return fail(renderRes.error);
      if (!renderRes.result) return fail({ code: 'not_implemented', message: TEXTURE_RENDERER_NO_IMAGE });

      const updateRes = ctx.updateTexture({
        id: resolvedTexture.id,
        name: resolvedTexture.name,
        image: renderRes.result.image,
        width: textureWidth,
        height: textureHeight,
        ifRevision: payload.ifRevision
      });
      if (!updateRes.ok && updateRes.error.code !== 'no_change') return fail(updateRes.error);

      const rollbackError = maybeRollbackTextureLoss({
        ctx,
        textureRenderer,
        texture: { id: resolvedTexture.id, name: resolvedTexture.name, width: textureWidth, height: textureHeight },
        ifRevision: payload.ifRevision,
        recoveryAttempts: recoveryAttempts.length,
        backup
      });
      if (rollbackError) return fail(rollbackError);

      const result: PaintFacesResult = {
        textureName: resolvedTexture.name,
        width: textureWidth,
        height: textureHeight,
        targets: 1,
        opsApplied: 1,
        changedPixels,
        resolvedSource: {
          coordSpace,
          width: sourceWidth,
          height: sourceHeight,
          faceUv: [faceBounds.x1, faceBounds.y1, faceBounds.x2, faceBounds.y2]
        }
      };
      if (recoveryAttempts.length > 0) {
        result.recovery = {
          applied: true,
          attempts: recoveryAttempts
        };
      }
      return ok(result);
    };

    let paintRes = paintOnce();
    if (!paintRes.ok && shouldRecover(paintRes.error)) {
      const reasonRaw = typeof paintRes.error.details?.reason === 'string' ? paintRes.error.details.reason : 'uv_recovery';
      const recoverRes = maybeRecover(reasonRaw);
      if (!recoverRes.ok) return fail(recoverRes.error);
      paintRes = paintOnce();
    }
    if (!paintRes.ok) return fail(paintRes.error);
    return ok(paintRes.value);
  });
};

type Rect = { x1: number; y1: number; x2: number; y2: number };

type OpBounds = { x1: number; y1: number; x2: number; y2: number };

const mergeRects = (rects: Rect[]): Rect | null => {
  if (!Array.isArray(rects) || rects.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  rects.forEach((rect) => {
    minX = Math.min(minX, rect.x1);
    minY = Math.min(minY, rect.y1);
    maxX = Math.max(maxX, rect.x2);
    maxY = Math.max(maxY, rect.y2);
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
};

const getRectSpan = (min: number, max: number): number => {
  const span = Math.ceil(max - min);
  return Number.isFinite(span) && span > 0 ? span : 1;
};

const getTextureOpBounds = (op: TextureOpLike): OpBounds => {
  switch (op.op) {
    case 'set_pixel': {
      const x = Math.round(op.x);
      const y = Math.round(op.y);
      return { x1: x, y1: y, x2: x + 1, y2: y + 1 };
    }
    case 'fill_rect':
    case 'draw_rect':
      return {
        x1: Math.min(op.x, op.x + op.width),
        y1: Math.min(op.y, op.y + op.height),
        x2: Math.max(op.x, op.x + op.width),
        y2: Math.max(op.y, op.y + op.height)
      };
    case 'draw_line': {
      const lineWidth = Math.max(1, Math.trunc(op.lineWidth ?? 1));
      const radius = Math.max(0, Math.floor(lineWidth / 2));
      return {
        x1: Math.min(op.x1, op.x2) - radius,
        y1: Math.min(op.y1, op.y2) - radius,
        x2: Math.max(op.x1, op.x2) + radius + 1,
        y2: Math.max(op.y1, op.y2) + radius + 1
      };
    }
    default:
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
  }
};

const doesBoundsIntersect = (a: Rect, b: Rect): boolean => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

const doesBoundsIntersectCanvas = (bounds: OpBounds, width: number, height: number): boolean =>
  doesBoundsIntersect(bounds, { x1: 0, y1: 0, x2: width, y2: height });

const doesBoundsIntersectRects = (bounds: OpBounds, rects: Rect[]): boolean =>
  rects.some((rect) => doesBoundsIntersect(bounds, rect));

const overlayPatchRects = (
  targetPixels: Uint8ClampedArray,
  patchPixels: Uint8ClampedArray,
  rects: Rect[],
  width: number,
  height: number
) => {
  rects.forEach((rect) => {
    const xStart = Math.max(0, Math.floor(rect.x1));
    const xEnd = Math.min(width, Math.ceil(rect.x2));
    const yStart = Math.max(0, Math.floor(rect.y1));
    const yEnd = Math.min(height, Math.ceil(rect.y2));
    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        const idx = (y * width + x) * 4;
        targetPixels[idx] = patchPixels[idx];
        targetPixels[idx + 1] = patchPixels[idx + 1];
        targetPixels[idx + 2] = patchPixels[idx + 2];
        targetPixels[idx + 3] = patchPixels[idx + 3];
      }
    }
  });
};

const overlayTextureSpaceRects = (
  targetPixels: Uint8ClampedArray,
  textureSpacePixels: Uint8ClampedArray,
  rects: Rect[],
  width: number,
  height: number
) => {
  rects.forEach((rect) => {
    const xStart = Math.max(0, Math.floor(rect.x1));
    const xEnd = Math.min(width, Math.ceil(rect.x2));
    const yStart = Math.max(0, Math.floor(rect.y1));
    const yEnd = Math.min(height, Math.ceil(rect.y2));
    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        const idx = (y * width + x) * 4;
        targetPixels[idx] = textureSpacePixels[idx];
        targetPixels[idx + 1] = textureSpacePixels[idx + 1];
        targetPixels[idx + 2] = textureSpacePixels[idx + 2];
        targetPixels[idx + 3] = textureSpacePixels[idx + 3];
      }
    }
  });
};

const countChangedPixels = (before: Uint8ClampedArray, after: Uint8ClampedArray): number => {
  if (before.length !== after.length) return 0;
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (
      before[i] !== after[i] ||
      before[i + 1] !== after[i + 1] ||
      before[i + 2] !== after[i + 2] ||
      before[i + 3] !== after[i + 3]
    ) {
      changed += 1;
    }
  }
  return changed;
};

const captureTextureBackup = (
  ctx: TextureToolContext,
  textureRenderer: NonNullable<TextureToolContext['textureRenderer']>,
  texture: { id?: string; name?: string; width?: number; height?: number }
): TextureBackup | null => {
  const readRes = ctx.editor.readTexture({ id: texture.id, name: texture.name });
  if (readRes.error || !readRes.result?.image) return null;
  const width = Number(readRes.result.width ?? texture.width ?? 0);
  const height = Number(readRes.result.height ?? texture.height ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const pixelRes = textureRenderer.readPixels?.({
    image: readRes.result.image,
    width,
    height
  });
  if (!pixelRes || pixelRes.error || !pixelRes.result) return null;
  return {
    image: readRes.result.image,
    width,
    height,
    opaquePixels: countOpaquePixels(pixelRes.result.data)
  };
};

const maybeRollbackTextureLoss = (params: {
  ctx: TextureToolContext;
  textureRenderer: NonNullable<TextureToolContext['textureRenderer']>;
  texture: { id?: string; name: string; width?: number; height?: number };
  ifRevision?: string;
  recoveryAttempts: number;
  backup: TextureBackup | null;
}): ToolError | null => {
  if (params.recoveryAttempts <= 0 || !params.backup) return null;
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
    message: 'paint_faces recovery produced severe texture loss; texture was rolled back.',
    details: {
      reason: 'texture_recovery_guard',
      recoveryAttempts: params.recoveryAttempts,
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
