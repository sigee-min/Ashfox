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
  intensity: 0.22,
  edge: 0.12,
  noise: 0.06,
  lightDir: 'tl_br'
} as const;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

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
    deterministicPixelNoise(localX, localY, config.seed) * 2 - 1
  ) * noise;
  const scale = 1 - direction * intensity - edgeRatio * edge + jitter;
  return {
    r: clamp(Math.round(color.r * scale), 0, 255),
    g: clamp(Math.round(color.g * scale), 0, 255),
    b: clamp(Math.round(color.b * scale), 0, 255)
  };
};
