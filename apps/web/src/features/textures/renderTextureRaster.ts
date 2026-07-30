import {
  composeTextureRaster,
  paintSurfacePixel,
  stableTextureSeed,
  type ProjectDocument,
  type RgbColor,
  type TextureAsset,
  type TextureComposition,
  type TextureCompositionRegion
} from '@ashfox/engine-core';

const previewColor = (texture: TextureAsset): string => {
  const value = texture.metadata?.previewColor;
  return typeof value === 'string' ? value : '#8e98a3';
};

const rgbColor = (value: string): RgbColor => ({
  r: Number.parseInt(value.slice(1, 3), 16),
  g: Number.parseInt(value.slice(3, 5), 16),
  b: Number.parseInt(value.slice(5, 7), 16)
});

const fillPixel = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: RgbColor
): void => {
  context.fillStyle = `rgb(${color.r} ${color.g} ${color.b})`;
  context.fillRect(x, y, 1, 1);
};

type SurfaceColorAt = (x: number, y: number) => RgbColor;

const extrudeSurfaceGutter = (
  context: CanvasRenderingContext2D,
  region: TextureCompositionRegion,
  gutter: number,
  colorAt: SurfaceColorAt
): void => {
  for (let y = -gutter; y < region.height + gutter; y += 1) {
    for (let x = -gutter; x < region.width + gutter; x += 1) {
      const inside =
        x >= 0 &&
        x < region.width &&
        y >= 0 &&
        y < region.height;
      if (inside) continue;
      const sourceX = Math.min(region.width - 1, Math.max(0, x));
      const sourceY = Math.min(region.height - 1, Math.max(0, y));
      fillPixel(
        context,
        region.x + x,
        region.y + y,
        colorAt(sourceX, sourceY)
      );
    }
  }
};

const renderGeneratedSurfaceRegion = (
  context: CanvasRenderingContext2D,
  region: TextureCompositionRegion,
  gutter: number
): void => {
  const base = rgbColor(region.color);
  const seed = stableTextureSeed(
    `${region.nodeId}:${region.face}`,
    0x41534846
  );
  const colorAt = (x: number, y: number): RgbColor =>
    paintSurfacePixel(
      base,
      x,
      y,
      region.width,
      region.height,
      seed
    );
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      fillPixel(
        context,
        region.x + x,
        region.y + y,
        colorAt(x, y)
      );
    }
  }
  extrudeSurfaceGutter(context, region, gutter, colorAt);
};

const renderGeneratedSurfacePatterns = (
  context: CanvasRenderingContext2D,
  composition: TextureComposition
): void => {
  if (!composition.generated) return;
  for (const region of composition.regions) {
    renderGeneratedSurfaceRegion(
      context,
      region,
      composition.gutter
    );
  }
};

const renderCanvasDetails = (
  context: CanvasRenderingContext2D,
  composition: TextureComposition
): void => {
  for (const detail of composition.canvasDetails) {
    context.fillStyle = detail.color;
    context.fillRect(
      detail.x,
      detail.y,
      detail.width,
      detail.height
    );
  }
};

export const renderTextureRaster = (
  document: ProjectDocument,
  texture: TextureAsset
): HTMLCanvasElement => {
  const canvas = window.document.createElement('canvas');
  canvas.width = texture.width;
  canvas.height = texture.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Texture canvas is unavailable.');
  const composition = composeTextureRaster(document, texture);

  context.fillStyle = composition.background ?? previewColor(texture);
  context.fillRect(0, 0, texture.width, texture.height);
  renderGeneratedSurfacePatterns(context, composition);
  renderCanvasDetails(context, composition);
  return canvas;
};
