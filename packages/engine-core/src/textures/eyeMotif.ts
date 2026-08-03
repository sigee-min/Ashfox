import type {
  ModelEyeGlyph
} from '../model';
import {
  eyeGlyphPixelRole
} from '../modeling/eyeGlyph';
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
  glyph: ModelEyeGlyph = 'square'
): RgbColor | null => {
  const role = eyeGlyphPixelRole(glyph, x, y, width, height);
  if (role === null) return null;
  const dark = mix(scale(iris, 0.16), { r: 4, g: 7, b: 10 }, 0.65);
  if (role === 'outline' || role === 'pupil') return dark;
  return mix(iris, { r: 255, g: 255, b: 255 }, 0.16);
};
