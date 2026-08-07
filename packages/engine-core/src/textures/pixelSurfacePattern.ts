import type {
  CubeFaceDirection
} from '../model';
import {
  DEFAULT_PIXEL_SHADE_STYLE,
  shadePixelRect,
  type RgbColor
} from './pixelRectShade';

export const FOCAL_PIXEL_SHADE_STYLE = {
  intensity: 0.09,
  edge: 0.02,
  noise: 0.025,
  lightDir: 'tl_br'
} as const;

const DIRECTIONAL_TONE: Readonly<
  Record<CubeFaceDirection, number>
> = {
  up: 1.08,
  south: 1,
  east: 1,
  north: 0.9,
  west: 0.9,
  down: 0.82
};

const clampChannel = (value: number): number =>
  Math.min(255, Math.max(0, Math.round(value)));

export const directionalSurfaceBaseColor = (
  color: RgbColor,
  face: CubeFaceDirection
): RgbColor => {
  const scale = DIRECTIONAL_TONE[face];
  return {
    r: clampChannel(color.r * scale),
    g: clampChannel(color.g * scale),
    b: clampChannel(color.b * scale)
  };
};

export const paintSurfacePixel = (
  color: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): RgbColor =>
  shadePixelRect(
    color,
    x,
    y,
    {
      x: 0,
      y: 0,
      width,
      height
    },
    {
      ...DEFAULT_PIXEL_SHADE_STYLE,
      seed
    }
  );

/**
 * Keeps the system-owned three-tone language on focal host planes while
 * reducing variation that can compete with eyes, mouths, controls, or signs.
 */
export const paintFocalSurfacePixel = (
  color: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
): RgbColor =>
  shadePixelRect(
    color,
    x,
    y,
    {
      x: 0,
      y: 0,
      width,
      height
    },
    {
      ...FOCAL_PIXEL_SHADE_STYLE,
      seed
    }
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
  paintSurfacePixel(
    directionalSurfaceBaseColor(color, face),
    x,
    y,
    width,
    height,
    seed
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
  paintFocalSurfacePixel(
    directionalSurfaceBaseColor(color, face),
    x,
    y,
    width,
    height,
    seed
  );
