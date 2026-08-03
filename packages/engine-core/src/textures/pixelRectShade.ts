import {
  deterministicPixelNoise
} from './deterministicPixel';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type PixelShadeDirection =
  | 'tl_br'
  | 'tr_bl'
  | 'top_bottom'
  | 'left_right';

export interface PixelShadeConfig {
  intensity: number;
  edge: number;
  noise: number;
  seed: number;
  lightDir: PixelShadeDirection;
}

export const DEFAULT_PIXEL_SHADE_STYLE = {
  intensity: 0.14,
  edge: 0.05,
  noise: 0.11,
  lightDir: 'tl_br'
} as const;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const TONE_LEVELS = [
  0.84,
  1,
  1.16
] as const;

const quantizedTone = (scale: number): number =>
  TONE_LEVELS.reduce((closest, candidate) =>
    Math.abs(candidate - scale) < Math.abs(closest - scale)
      ? candidate
      : closest
  );

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
  direction: PixelShadeDirection
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

export const shadePixelRect = (
  color: RgbColor,
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
  config: PixelShadeConfig
): RgbColor => {
  const tinyRect = rect.width * rect.height <= 4;
  const thinRect = rect.width <= 2 || rect.height <= 2;
  const intensity = tinyRect ? config.intensity * 0.3 : config.intensity;
  const edge = thinRect ? 0 : config.edge;
  const noise = thinRect ? 0 : config.noise;
  const edgeSpan = Math.max(
    1,
    Math.floor(Math.min(rect.width, rect.height) / 2)
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
  const scale = quantizedTone(
    1 - direction * intensity - edgeRatio * edge + jitter
  );
  return {
    r: clamp(Math.round(color.r * scale), 0, 255),
    g: clamp(Math.round(color.g * scale), 0, 255),
    b: clamp(Math.round(color.b * scale), 0, 255)
  };
};
