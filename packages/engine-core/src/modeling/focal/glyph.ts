import type {
  ModelFeatureGlyph,
  ModelFeatureMotif
} from '../../model';

export type FocalFeaturePixelRole =
  | 'field'
  | 'nose'
  | 'mouth'
  | 'fang'
  | 'beak';

const insideBounds = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean => x >= 0 && y >= 0 && x < width && y < height;

const centeredPixel = (
  coordinate: number,
  extent: number
): boolean => {
  const center = Math.floor(extent / 2);
  return coordinate === center || (
    extent % 2 === 0 && coordinate === center - 1
  );
};

const croppedCorner = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean =>
  width >= 3 &&
  height >= 2 &&
  (x === 0 || x === width - 1) &&
  (y === 0 || y === height - 1);

export const focalFeatureGlyphPixelRole = (
  motif: Exclude<ModelFeatureMotif, 'patch'>,
  glyph: ModelFeatureGlyph | undefined,
  x: number,
  y: number,
  width: number,
  height: number
): FocalFeaturePixelRole | null => {
  if (!insideBounds(x, y, width, height)) return null;

  if (motif === 'nose') {
    const resolved = glyph === 'snout' ? 'snout' : 'dot';
    if (resolved === 'dot') {
      return centeredPixel(x, width) && centeredPixel(y, height)
        ? 'nose'
        : null;
    }
    if (croppedCorner(x, y, width, height)) return null;
    const noseY = Math.floor(height / 2);
    return centeredPixel(x, width) && y === noseY ? 'nose' : 'field';
  }

  if (motif === 'mouth') {
    const resolved = glyph === 'fang' || glyph === 'beak'
      ? glyph
      : 'neutral';
    const mouthY = Math.max(0, Math.floor((height - 1) / 2));
    if (resolved === 'neutral') return y === mouthY ? 'mouth' : null;
    if (resolved === 'fang') {
      if (y === mouthY) return 'mouth';
      return y === mouthY + 1 && centeredPixel(x, width)
        ? 'fang'
        : null;
    }
    if (croppedCorner(x, y, width, height)) return null;
    return centeredPixel(x, width) ? 'mouth' : 'beak';
  }

  return null;
};
