import {
  deterministicPixelNoise
} from './deterministicPixel';
import {
  gamutMappedOklabToRgb,
  rgbToOklab
} from './oklabColor';

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
  intensity: 0.16,
  edge: 0.03,
  noise: 0.04,
  lightDir: 'tl_br'
} as const;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export type PixelToneRole = 'shadow' | 'base' | 'light';

export interface PixelTonePalette {
  shadow: RgbColor;
  base: RgbColor;
  light: RgbColor;
}

const TONE_LIGHTNESS_STEP = 0.08;
const MINIMUM_GLOBAL_BASE_LIGHTNESS = 0.2;
const MAXIMUM_GLOBAL_BASE_LIGHTNESS = 0.86;
const PIXEL_TONE_PALETTE_CACHE_LIMIT = 256;
const tonePaletteCache = new Map<string, PixelTonePalette>();

const canonicalChannel = (value: number): number =>
  clamp(Math.round(value), 0, 255);

const frozenColor = (color: RgbColor): RgbColor => Object.freeze({
  r: canonicalChannel(color.r),
  g: canonicalChannel(color.g),
  b: canonicalChannel(color.b)
});

const cacheTonePalette = (
  key: string,
  palette: PixelTonePalette
): PixelTonePalette => {
  if (tonePaletteCache.size >= PIXEL_TONE_PALETTE_CACHE_LIMIT) {
    const oldest = tonePaletteCache.keys().next().value;
    if (oldest !== undefined) tonePaletteCache.delete(oldest);
  }
  tonePaletteCache.set(key, palette);
  return palette;
};

/**
 * Derives a hue-preserving, luminance-spaced role palette. Extreme authored
 * black and white become renderable dark/light anchors so large surfaces do
 * not collapse to one or two indistinguishable tones.
 */
export const pixelTonePalette = (color: RgbColor): PixelTonePalette => {
  return pixelTonePaletteAtLightnessOffset(color, 0);
};

export const pixelTonePaletteAtLightnessOffset = (
  color: RgbColor,
  lightnessOffset: number
): PixelTonePalette => {
  const red = canonicalChannel(color.r);
  const green = canonicalChannel(color.g);
  const blue = canonicalChannel(color.b);
  const offset = Number(
    clamp(lightnessOffset, -0.12, 0.06).toFixed(4)
  );
  const key =
    `${red},${green},${blue}:` +
    offset.toFixed(4);
  const cached = tonePaletteCache.get(key);
  if (cached) return cached;
  const canonical = Object.freeze({
    r: red,
    g: green,
    b: blue
  });
  const source = rgbToOklab(canonical);
  const globalBaseLightness = clamp(
    source.l,
    MINIMUM_GLOBAL_BASE_LIGHTNESS,
    MAXIMUM_GLOBAL_BASE_LIGHTNESS
  );
  const baseLightness = clamp(
    globalBaseLightness + offset,
    TONE_LIGHTNESS_STEP,
    1 - TONE_LIGHTNESS_STEP
  );
  const atLightness = (lightness: number): RgbColor => frozenColor(
    gamutMappedOklabToRgb({
      l: lightness,
      a: source.a,
      b: source.b
    })
  );
  return cacheTonePalette(key, Object.freeze({
    shadow: atLightness(baseLightness - TONE_LIGHTNESS_STEP),
    base: atLightness(baseLightness),
    light: atLightness(baseLightness + TONE_LIGHTNESS_STEP)
  }));
};

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
  const thinRect = rect.width <= 2 || rect.height <= 2;
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
  const scale = clamp(
    1 - direction * config.intensity - edgeRatio * edge + jitter,
    0,
    2
  );
  return {
    r: clamp(Math.round(color.r * scale), 0, 255),
    g: clamp(Math.round(color.g * scale), 0, 255),
    b: clamp(Math.round(color.b * scale), 0, 255)
  };
};
