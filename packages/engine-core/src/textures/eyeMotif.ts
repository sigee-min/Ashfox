import type {
  ModelEyeGlyph
} from '../model';
import {
  eyeGlyphPixelRole,
  type EyePupilBias
} from '../modeling/eye/glyph';
import type {
  RgbColor
} from './pixelRectShade';

const clamp = (value: number): number =>
  Math.min(255, Math.max(0, Math.round(value)));

const scale = (color: RgbColor, amount: number): RgbColor => ({
  r: clamp(color.r * amount),
  g: clamp(color.g * amount),
  b: clamp(color.b * amount)
});

const mix = (
  left: RgbColor,
  right: RgbColor,
  amount: number
): RgbColor => ({
  r: clamp(left.r * (1 - amount) + right.r * amount),
  g: clamp(left.g * (1 - amount) + right.g * amount),
  b: clamp(left.b * (1 - amount) + right.b * amount)
});

const perceivedLuminance = (color: RgbColor): number =>
  color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

const normalizeReadableIris = (color: RgbColor): RgbColor => {
  const luminance = perceivedLuminance(color);
  const targetLuminance = Math.min(168, Math.max(72, luminance));
  const deltas = [
    color.r - luminance,
    color.g - luminance,
    color.b - luminance
  ];
  const chromaRetention = deltas.reduce((retention, delta) => {
    if (delta > 0) {
      return Math.min(retention, (255 - targetLuminance) / delta);
    }
    if (delta < 0) {
      return Math.min(retention, targetLuminance / -delta);
    }
    return retention;
  }, 1);
  return {
    r: clamp(targetLuminance + deltas[0] * chromaRetention),
    g: clamp(targetLuminance + deltas[1] * chromaRetention),
    b: clamp(targetLuminance + deltas[2] * chromaRetention)
  };
};

/**
 * Paints one deliberately flat pixel glyph without introducing geometry.
 * Null keeps the already-derived parent surface pixel.
 */
export const paintEyeMotifPixel = (
  iris: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number,
  glyph: ModelEyeGlyph = 'square',
  pupilBias: EyePupilBias = 0
): RgbColor | null => {
  const role = eyeGlyphPixelRole(
    glyph,
    x,
    y,
    width,
    height,
    pupilBias
  );
  if (role === null) return null;
  const dark = mix(scale(iris, 0.16), { r: 4, g: 7, b: 10 }, 0.65);
  if (role === 'outline' || role === 'pupil') return dark;
  if (role === 'sclera') {
    return mix({ r: 247, g: 248, b: 244 }, iris, 0.08);
  }
  return mix(
    normalizeReadableIris(iris),
    { r: 255, g: 255, b: 255 },
    0.16
  );
};
