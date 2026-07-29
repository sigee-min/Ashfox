import type { FillRectShadeLike } from './textureOps';
import { clamp } from './math';
import { shadeMinecraftPixel } from '@ashfox/engine-core';

export type RgbaLike = { r: number; g: number; b: number; a: number };

type FillShadeDirection = 'tl_br' | 'tr_bl' | 'top_bottom' | 'left_right';

export type NormalizedFillShade = {
  intensity: number;
  edge: number;
  noise: number;
  seed: number;
  lightDir: FillShadeDirection;
};

export const resolveFillRectShade = (
  shade: FillRectShadeLike | undefined,
  xStart: number,
  yStart: number,
  xEnd: number,
  yEnd: number,
  color: RgbaLike
): NormalizedFillShade | null => {
  if (shade === false) return null;
  const config = shade === undefined || shade === true ? {} : shade;
  if (config.enabled === false) return null;
  const lightDir = resolveLightDir(config.lightDir);
  const intensity = clampUnit(config.intensity ?? 0.22);
  const edge = clampUnit(config.edge ?? 0.12);
  const noise = clampUnit(config.noise ?? 0.06);
  const seed = Number.isFinite(config.seed)
    ? Math.trunc(config.seed as number)
    : hashSeed(
        xStart,
        yStart,
        xEnd,
        yEnd,
        color.r,
        color.g,
        color.b,
        color.a
      );
  return {
    intensity,
    edge,
    noise,
    seed,
    lightDir
  };
};

export const applyShadedFillRect = (
  data: Uint8ClampedArray,
  textureWidth: number,
  xStart: number,
  yStart: number,
  xEnd: number,
  yEnd: number,
  color: RgbaLike,
  shade: NormalizedFillShade
) => {
  for (let yy = yStart; yy < yEnd; yy += 1) {
    for (let xx = xStart; xx < xEnd; xx += 1) {
      const shaded = shadeMinecraftPixel(
        color,
        xx,
        yy,
        {
          x: xStart,
          y: yStart,
          width: Math.max(1, xEnd - xStart),
          height: Math.max(1, yEnd - yStart)
        },
        shade
      );
      const idx = (yy * textureWidth + xx) * 4;
      data[idx] = shaded.r;
      data[idx + 1] = shaded.g;
      data[idx + 2] = shaded.b;
      data[idx + 3] = color.a;
    }
  }
};

const clampUnit = (value: number): number => clamp(Number(value), 0, 1);

const resolveLightDir = (value: unknown): FillShadeDirection => {
  if (value === 'tr_bl' || value === 'top_bottom' || value === 'left_right') return value;
  return 'tl_br';
};

const hashSeed = (...values: number[]): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < values.length; i += 1) {
    h ^= Math.trunc(values[i]) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};
