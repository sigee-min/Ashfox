import type {
  CubeFaceDirection
} from '../model';
import {
  paintGeneratedTonePixel,
  generatedSurfaceTonePalette
} from './generatedPixelShade';
import {
  DEFAULT_PIXEL_SHADE_STYLE,
  type RgbColor
} from './pixelRectShade';

export const FOCAL_PIXEL_SHADE_STYLE = {
  ...DEFAULT_PIXEL_SHADE_STYLE,
  noise: 0.015
} as const;

export const directionalSurfaceBaseColor = (
  color: RgbColor,
  face: CubeFaceDirection
): RgbColor => generatedSurfaceTonePalette(color, face).base;

const paintGeneratedSurfacePixel = (
  color: RgbColor,
  face: CubeFaceDirection | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  style: typeof DEFAULT_PIXEL_SHADE_STYLE | typeof FOCAL_PIXEL_SHADE_STYLE
): RgbColor => paintGeneratedTonePixel(
  generatedSurfaceTonePalette(color, face),
  x,
  y,
  {
    x: 0,
    y: 0,
    width,
    height
  },
  {
    ...style,
    seed
  }
);

export const paintSurfacePixel = (
  color: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): RgbColor =>
  paintGeneratedSurfacePixel(
    color,
    undefined,
    x,
    y,
    width,
    height,
    seed,
    DEFAULT_PIXEL_SHADE_STYLE
  );

/**
 * Keeps the same macro light field and three-tone coverage on focal host
 * planes while reducing only the high-frequency variation that can compete
 * with eyes, mouths, controls, or signs.
 */
export const paintFocalSurfacePixel = (
  color: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): RgbColor =>
  paintGeneratedSurfacePixel(
    color,
    undefined,
    x,
    y,
    width,
    height,
    seed,
    FOCAL_PIXEL_SHADE_STYLE
  );

export const paintDirectionalSurfacePixel = (
  color: RgbColor,
  face: CubeFaceDirection,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): RgbColor =>
  paintGeneratedSurfacePixel(
    color,
    face,
    x,
    y,
    width,
    height,
    seed,
    DEFAULT_PIXEL_SHADE_STYLE
  );

export const paintDirectionalFocalSurfacePixel = (
  color: RgbColor,
  face: CubeFaceDirection,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): RgbColor =>
  paintGeneratedSurfacePixel(
    color,
    face,
    x,
    y,
    width,
    height,
    seed,
    FOCAL_PIXEL_SHADE_STYLE
  );
