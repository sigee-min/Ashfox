import type {
  CubeFaceDirection
} from '../model';
import {
  DEFAULT_PIXEL_SHADE_STYLE,
  shadePixelRect,
  type RgbColor
} from './pixelRectShade';

const DIRECTIONAL_TONE: Readonly<
  Record<CubeFaceDirection, number>
> = {
  up: 1.08,
  south: 1,
  east: 0.96,
  north: 0.92,
  west: 0.88,
  down: 0.8
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
