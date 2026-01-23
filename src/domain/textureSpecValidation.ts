import type { Limits } from './model';
import type { DomainResult } from './result';
import { fail, ok } from './result';
import { checkDimensions } from './dimensions';
import { validateUvPaintSpec } from './uvPaint';
import { isTextureOp, MAX_TEXTURE_OPS } from './textureOps';

export type TextureSpecLike = {
  mode?: 'create' | 'update';
  id?: string;
  targetId?: string;
  targetName?: string;
  name?: string;
  width?: number;
  height?: number;
  uvPaint?: unknown;
  ops?: unknown[];
};

export type TextureSpecWithSize = TextureSpecLike & {
  width: number;
  height: number;
};

export const normalizeTextureSpecSize = (
  spec: TextureSpecLike,
  fallback?: { width?: number; height?: number }
): DomainResult<TextureSpecWithSize> => {
  const width = pickFinite(spec.width, fallback?.width);
  const height = pickFinite(spec.height, fallback?.height);
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    return fail('invalid_payload', `texture width must be > 0 (${specLabel(spec)})`);
  }
  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
    return fail('invalid_payload', `texture height must be > 0 (${specLabel(spec)})`);
  }
  return ok({ ...spec, width, height });
};

export const validateTextureSpecs = (
  textures: TextureSpecLike[],
  limits: Limits
): DomainResult<{ valid: true }> => {
  if (!Array.isArray(textures) || textures.length === 0) {
    return fail('invalid_payload', 'textures array is required');
  }
  for (const tex of textures) {
    const label = tex?.name ?? tex?.targetName ?? tex?.targetId ?? 'texture';
    const mode = tex?.mode ?? 'create';
    if (mode !== 'create' && mode !== 'update') {
      return fail('invalid_payload', `unsupported texture mode ${mode} (${label})`);
    }
    if (mode === 'create' && !tex?.name) {
      return fail('invalid_payload', `texture name is required (${label})`);
    }
    if (mode === 'update' && !tex?.targetId && !tex?.targetName) {
      return fail('invalid_payload', `targetId or targetName is required (${label})`);
    }
    const sizeRes = normalizeTextureSpecSize(tex);
    if (!sizeRes.ok) return sizeRes;
    const width = Number(sizeRes.data.width);
    const height = Number(sizeRes.data.height);
    const sizeCheck = checkDimensions(width, height, { requireInteger: false, maxSize: limits.maxTextureSize });
    if (!sizeCheck.ok) {
      if (sizeCheck.reason === 'non_positive') {
        const axis = sizeCheck.axis === 'height' ? 'height' : 'width';
        return fail('invalid_payload', `texture ${axis} must be > 0 (${label})`);
      }
      return fail('invalid_payload', `texture size exceeds max ${limits.maxTextureSize} (${label})`);
    }
    const ops = Array.isArray(tex?.ops) ? tex.ops : [];
    if (ops.length > MAX_TEXTURE_OPS) {
      return fail('invalid_payload', `too many texture ops (>${MAX_TEXTURE_OPS}) (${label})`);
    }
    for (const op of ops) {
      if (!isTextureOp(op)) {
        return fail('invalid_payload', `invalid texture op (${label})`);
      }
    }
    if (tex?.uvPaint !== undefined) {
      const uvPaintRes = validateUvPaintSpec(tex.uvPaint, limits, label);
      if (!uvPaintRes.ok) return uvPaintRes as DomainResult<{ valid: true }>;
    }
  }
  return ok({ valid: true });
};

const specLabel = (spec: TextureSpecLike): string =>
  spec?.name ?? spec?.targetName ?? spec?.targetId ?? 'texture';

const pickFinite = (...values: Array<number | undefined>) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};
