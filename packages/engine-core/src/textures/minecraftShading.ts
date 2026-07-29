export type MinecraftShadeDirection =
  | 'tl_br'
  | 'tr_bl'
  | 'top_bottom'
  | 'left_right';

export interface MinecraftShadeConfig {
  intensity: number;
  edge: number;
  noise: number;
  seed: number;
  lightDir: MinecraftShadeDirection;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const directionalShade = (
  u: number,
  v: number,
  direction: MinecraftShadeDirection
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

export const deterministicPixelNoise = (
  x: number,
  y: number,
  seed: number
): number => {
  let hash = (
    seed ^
    Math.imul(Math.trunc(x), 0x9e3779b1) ^
    Math.imul(Math.trunc(y), 0x85ebca6b)
  ) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return hash / 0xffffffff;
};

export const stableTextureSeed = (
  value: string,
  seed: number
): number => {
  let hash = (2166136261 ^ Math.trunc(seed)) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};

export const shadeMinecraftPixel = (
  color: RgbColor,
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
  config: MinecraftShadeConfig
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
    deterministicPixelNoise(x, y, config.seed) * 2 - 1
  ) * noise;
  const scale = 1 - direction * intensity - edgeRatio * edge + jitter;
  return {
    r: clamp(Math.round(color.r * scale), 0, 255),
    g: clamp(Math.round(color.g * scale), 0, 255),
    b: clamp(Math.round(color.b * scale), 0, 255)
  };
};
