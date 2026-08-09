import type {
  ModelEyeGlyph,
  ModelFeatureGlyph,
  ModelFeatureMotif
} from '../model';
import {
  focalFeatureGlyphPixelRole
} from '../modeling/focal/glyph';
import type { EyePupilBias } from '../modeling/eye/glyph';
import {
  paintEyeMotifPixel
} from './eyeMotif';
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

/** Paints a flat, deterministic focal glyph above generated surface texture. */
export const paintFeatureMotifPixel = (
  motif: Exclude<ModelFeatureMotif, 'patch'>,
  color: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number,
  glyph?: ModelFeatureGlyph,
  eyePupilBias: EyePupilBias = 0
): RgbColor | null => {
  if (motif === 'eye') {
    return paintEyeMotifPixel(
      color,
      x,
      y,
      width,
      height,
      glyph as ModelEyeGlyph | undefined,
      eyePupilBias
    );
  }
  const role = focalFeatureGlyphPixelRole(
    motif,
    glyph,
    x,
    y,
    width,
    height
  );
  if (role === null) return null;
  const dark = mix(scale(color, 0.18), { r: 5, g: 6, b: 8 }, 0.62);
  if (
    role === 'nose' ||
    role === 'mouth'
  ) {
    return dark;
  }
  if (role === 'fang') return { r: 245, g: 239, b: 215 };
  if (role === 'field') return mix(color, { r: 255, g: 255, b: 255 }, 0.12);
  return mix(color, { r: 255, g: 255, b: 255 }, 0.06);
};
