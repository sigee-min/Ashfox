import type { ModelEyeGlyph } from '../../model';

export type EyePupilBias = -1 | 0 | 1;

export type EyeGlyphPixelRole =
  | 'outline'
  | 'sclera'
  | 'iris'
  | 'pupil';

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

const centerIndices = (
  length: number,
  bias: EyePupilBias
): readonly number[] => {
  const lower = Math.floor((length - 1) / 2);
  const upper = Math.ceil((length - 1) / 2);
  if (lower === upper) return [lower];
  if (bias < 0) return [lower];
  if (bias > 0) return [upper];
  return [lower, upper];
};

const isHorizontalIris = (
  x: number,
  y: number,
  pupilColumns: readonly number[],
  pupilRows: readonly number[]
): boolean =>
  pupilRows.includes(y) &&
  pupilColumns.some((column) => Math.abs(x - column) === 1);

export const eyeGlyphPixelRole = (
  glyph: ModelEyeGlyph | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  pupilBias: EyePupilBias = 0
): EyeGlyphPixelRole | null => {
  if (!insideBounds(x, y, width, height)) return null;
  const resolved = glyph ?? 'square';
  const pupilColumns = centerIndices(width, pupilBias);
  const pupilRows = centerIndices(height, 0);

  if (isCroppedCorner(x, y, width, height)) return null;

  if (resolved === 'slit') {
    const pupilVertical = height < 3 || (y > 0 && y < height - 1);
    if (pupilColumns.includes(x) && pupilVertical) return 'pupil';
    if (
      pupilVertical &&
      pupilColumns.some((column) => Math.abs(x - column) === 1)
    ) {
      return 'iris';
    }
  } else {
    if (pupilColumns.includes(x) && pupilRows.includes(y)) return 'pupil';
    if (isHorizontalIris(x, y, pupilColumns, pupilRows)) return 'iris';
  }

  const hasOutline = width >= 5 && height >= 3;
  if (
    hasOutline &&
    (x === 0 || x === width - 1) &&
    (resolved === 'slit'
      ? height < 3 || (y > 0 && y < height - 1)
      : pupilRows.includes(y))
  ) {
    return 'outline';
  }
  return 'sclera';
};
