import type { CubeFaceDirection } from '../model';
import { deterministicPixelNoise } from './deterministicPixel';
import {
  pixelTonePaletteAtLightnessOffset,
  type PixelShadeConfig,
  type PixelTonePalette,
  type PixelToneRole,
  type RgbColor
} from './pixelRectShade';

export interface GeneratedToneCutoffs {
  shadowMax: number;
  lightMin: number;
}

export const DEFAULT_GENERATED_TONE_CUTOFFS = Object.freeze({
  shadowMax: -0.035,
  lightMin: 0.035
}) satisfies GeneratedToneCutoffs;

const DIRECTIONAL_LIGHTNESS_OFFSET: Readonly<
  Record<CubeFaceDirection, number>
> = Object.freeze({
  up: 0.06,
  south: 0,
  east: 0,
  north: -0.06,
  west: -0.06,
  down: -0.12
});

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const clusteredNoise = (
  x: number,
  y: number,
  seed: number
): number =>
  deterministicPixelNoise(x, y, seed) * 0.1 +
  deterministicPixelNoise(
    Math.floor(x / 2),
    Math.floor(y / 2),
    seed ^ 0x9e3779b9
  ) * 0.4 +
  deterministicPixelNoise(
    Math.floor(x / 4),
    Math.floor(y / 4),
    seed ^ 0x85ebca6b
  ) * 0.5;

const directionalShade = (
  u: number,
  v: number,
  direction: PixelShadeConfig['lightDir']
): number => {
  switch (direction) {
    case 'tr_bl':
      return v - u;
    case 'top_bottom':
      return v * 2 - 1;
    case 'left_right':
      return u * 2 - 1;
    case 'tl_br':
      return u + v - 1;
  }
};

export const generatedToneScore = (
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
  config: PixelShadeConfig
): number => {
  if (rect.width * rect.height <= 4) return 0;
  const thinRect = rect.width <= 2 || rect.height <= 2;
  const edge = thinRect ? 0 : config.edge;
  const noise = thinRect ? 0 : config.noise;
  const edgeSpan = Math.max(
    1,
    Math.min(2, Math.floor(Math.min(rect.width, rect.height) / 4))
  );
  const localX = x - rect.x;
  const localY = y - rect.y;
  const u = rect.width <= 1 ? 0.5 : localX / (rect.width - 1);
  const v = rect.height <= 1 ? 0.5 : localY / (rect.height - 1);
  const direction = directionalShade(u, v, config.lightDir);
  const borderDistance = Math.min(
    localX,
    rect.width - 1 - localX,
    localY,
    rect.height - 1 - localY
  );
  const edgeRatio = 1 - clamp(borderDistance / edgeSpan, 0, 1);
  const jitter = (
    clusteredNoise(localX, localY, config.seed) * 2 - 1
  ) * noise;
  return -direction * config.intensity - edgeRatio * edge + jitter;
};

export const generatedToneRole = (
  score: number,
  cutoffs: GeneratedToneCutoffs
): PixelToneRole =>
  score <= cutoffs.shadowMax
    ? 'shadow'
    : score >= cutoffs.lightMin
      ? 'light'
      : 'base';

export const generatedSurfaceTonePalette = (
  color: RgbColor,
  face?: CubeFaceDirection
): PixelTonePalette =>
  pixelTonePaletteAtLightnessOffset(
    color,
    face === undefined ? 0 : DIRECTIONAL_LIGHTNESS_OFFSET[face]
  );

export const paintGeneratedTonePixel = (
  palette: PixelTonePalette,
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
  config: PixelShadeConfig,
  cutoffs: GeneratedToneCutoffs = DEFAULT_GENERATED_TONE_CUTOFFS
): RgbColor =>
  palette[generatedToneRole(
    generatedToneScore(x, y, rect, config),
    cutoffs
  )];
