import {
  composeTextureRaster,
  paintSurfacePixel,
  stableTextureSeed,
  type ProjectDocument,
  type RgbColor,
  type TextureAsset,
  type TextureComposition
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

const renderGeneratedSurfacePatterns = (
  context: CanvasRenderingContext2D,
  composition: TextureComposition
): void => {
  if (!composition.generated) return;
  for (const region of composition.regions) {
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
    for (let x = 0; x < region.width; x += 1) {
      fillPixel(context, region.x + x, region.y - 1, colorAt(x, 0));
      fillPixel(
        context,
        region.x + x,
        region.y + region.height,
        colorAt(x, region.height - 1)
      );
    }
    for (let y = 0; y < region.height; y += 1) {
      fillPixel(context, region.x - 1, region.y + y, colorAt(0, y));
      fillPixel(
        context,
        region.x + region.width,
        region.y + y,
        colorAt(region.width - 1, y)
      );
    }
    fillPixel(context, region.x - 1, region.y - 1, colorAt(0, 0));
    fillPixel(
      context,
      region.x + region.width,
      region.y - 1,
      colorAt(region.width - 1, 0)
    );
    fillPixel(
      context,
      region.x - 1,
      region.y + region.height,
      colorAt(0, region.height - 1)
    );
    fillPixel(
      context,
      region.x + region.width,
      region.y + region.height,
      colorAt(region.width - 1, region.height - 1)
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
