import {
  composeTextureRaster,
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

const toneColor = (color: RgbColor, tone: number): RgbColor => ({
  r: Math.min(255, Math.max(0, Math.round(color.r * tone))),
  g: Math.min(255, Math.max(0, Math.round(color.g * tone))),
  b: Math.min(255, Math.max(0, Math.round(color.b * tone)))
});

const renderGeneratedFaceTones = (
  context: CanvasRenderingContext2D,
  composition: TextureComposition
): void => {
  if (!composition.generated) return;
  for (const region of composition.regions) {
    const color = toneColor(rgbColor(region.color), region.tone);
    context.fillStyle = `rgb(${color.r} ${color.g} ${color.b})`;
    context.fillRect(
      region.x - 1,
      region.y - 1,
      region.width + 2,
      region.height + 2
    );
    context.fillRect(
      region.x,
      region.y,
      region.width,
      region.height
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
  renderGeneratedFaceTones(context, composition);
  renderCanvasDetails(context, composition);
  return canvas;
};
