import type { ModelEyeGlyph } from '../model';

export type EyeGlyphPixelRole = 'outline' | 'iris' | 'pupil';

const insideBounds = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean =>
  x >= 0 && y >= 0 && x < width && y < height;

const isCroppedCorner = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean =>
  width >= 4 &&
  height >= 3 &&
  (x === 0 || x === width - 1) &&
  (y === 0 || y === height - 1);

export const eyeGlyphPixelRole = (
  glyph: ModelEyeGlyph | undefined,
  x: number,
  y: number,
  width: number,
  height: number
): EyeGlyphPixelRole | null => {
  if (!insideBounds(x, y, width, height)) return null;
  const resolved = glyph ?? 'square';
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  if (resolved === 'dot') {
    const halfWidth = width % 2 === 0 ? 1 : 0;
    const halfHeight = height % 2 === 0 ? 1 : 0;
    return (
      x >= centerX - halfWidth &&
      x <= centerX &&
      y >= centerY - halfHeight &&
      y <= centerY
    ) ? 'pupil' : null;
  }

  if (isCroppedCorner(x, y, width, height)) return null;
  const hasOutline = width >= 4 && height >= 3;
  if (
    hasOutline &&
    (x === 0 || x === width - 1 || y === 0 || y === height - 1)
  ) {
    return 'outline';
  }

  if (resolved === 'slit') {
    return x === centerX ? 'pupil' : 'iris';
  }
  if (x === centerX && (height < 4 || y > 0 && y < height - 1)) {
    return 'pupil';
  }
  return 'iris';
};
