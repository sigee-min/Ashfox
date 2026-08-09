import type { RgbColor } from '../pixelRectShade';

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

export const parseSurfaceColor = (value: string): RgbColor => {
  const match = HEX_COLOR.exec(value);
  if (!match) return { r: 142, g: 152, b: 163 };
  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
};
