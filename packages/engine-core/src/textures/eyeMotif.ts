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

const insideEye = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean => {
  const horizontal = (x + 0.5 - width / 2) / (width / 2);
  const vertical = (y + 0.5 - height / 2) / (height / 2);
  return horizontal * horizontal + vertical * vertical <= 1;
};

const isOutline = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean =>
  [[-1, 0], [1, 0], [0, -1], [0, 1]].some(
    ([dx, dy]) => !insideEye(x + dx, y + dy, width, height)
  );

/**
 * Paints one compact, readable eye without introducing geometry. Null keeps
 * the already-derived parent surface pixel.
 */
export const paintEyeMotifPixel = (
  iris: RgbColor,
  x: number,
  y: number,
  width: number,
  height: number
): RgbColor | null => {
  if (!insideEye(x, y, width, height)) return null;
  const dark = mix(scale(iris, 0.16), { r: 4, g: 7, b: 10 }, 0.65);
  if (isOutline(x, y, width, height)) return dark;

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const pupilHalfWidth = Math.max(0, Math.floor(width / 7));
  const pupilHalfHeight = Math.max(0, Math.floor(height / 4));
  const inPupil =
    Math.abs(x - centerX) <= pupilHalfWidth &&
    Math.abs(y - centerY) <= pupilHalfHeight;
  const highlightX = Math.max(1, centerX - 1);
  const highlightY = Math.max(1, centerY - 1);
  if (x === highlightX && y === highlightY) {
    return scale(iris, 1.25);
  }
  if (inPupil) return dark;

  const radialDistance =
    Math.abs(x - centerX) + Math.abs(y - centerY);
  return scale(iris, radialDistance <= 1 ? 1.15 : 0.86);
};
