import type { CubeFaceDirection } from '../../model';
import {
  pixelTonePaletteAtLightnessOffset,
  type PixelTonePalette,
  type RgbColor
} from '../pixelRectShade';
import type {
  SurfaceTextureContrast
} from './contract';

const DIRECTIONAL_LIGHTNESS_OFFSET: Readonly<
  Record<CubeFaceDirection, number>
> = Object.freeze({
  up: 0.06,
  south: 0,
  east: 0,
  north: -0.06,
  west: -0.06,
  down: -0.12
});

export const generatedSurfaceTonePalette = (
  color: RgbColor,
  face?: CubeFaceDirection,
  contrast?: SurfaceTextureContrast
): PixelTonePalette =>
  pixelTonePaletteAtLightnessOffset(
    color,
    face === undefined ? 0 : DIRECTIONAL_LIGHTNESS_OFFSET[face],
    contrast === undefined
      ? 0.08
      : contrast === 'subtle' ? 0.035 : contrast === 'bold' ? 0.085 : 0.06
  );
