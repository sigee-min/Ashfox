import {
  DEFAULT_PIXEL_SHADE_STYLE,
  shadePixelRect,
  type RgbColor
} from './pixelRectShade';

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
