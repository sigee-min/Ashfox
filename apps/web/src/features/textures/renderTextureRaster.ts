import {
  composeTextureRaster,
  shadeMinecraftPixel,
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

const renderMinecraftPattern = (
  context: CanvasRenderingContext2D,
  texture: TextureAsset,
  composition: TextureComposition
): void => {
  const recipe = composition.recipe;
  if (!recipe) return;
  const image = context.getImageData(0, 0, texture.width, texture.height);
  for (const region of composition.regions) {
    const color = toneColor(rgbColor(region.color), region.tone);
    const xEnd = region.x + region.width;
    const yEnd = region.y + region.height;
    for (let y = region.y; y < yEnd; y += 1) {
      for (let x = region.x; x < xEnd; x += 1) {
        const shaded = shadeMinecraftPixel(
          color,
          x,
          y,
          region,
          {
            intensity: recipe.intensity,
            edge: recipe.edge,
            noise: recipe.noise,
            seed: region.seed,
            lightDir: recipe.lightDir
          }
        );
        const index = (y * texture.width + x) * 4;
        image.data[index] = shaded.r;
        image.data[index + 1] = shaded.g;
        image.data[index + 2] = shaded.b;
        image.data[index + 3] = 255;
      }
    }
  }
  context.putImageData(image, 0, 0);
};

const renderSurfaceDetails = (
  context: CanvasRenderingContext2D,
  composition: TextureComposition
): void => {
  for (const region of composition.regions) {
    for (const detail of region.details) {
      const x = region.x + Math.floor(detail.u * region.width);
      const y = region.y + Math.floor(detail.v * region.height);
      let width = Math.max(1, Math.round(detail.width * region.width));
      let height = Math.max(1, Math.round(detail.height * region.height));
      width = Math.min(width, region.x + region.width - x);
      height = Math.min(height, region.y + region.height - y);
      context.fillStyle = detail.color;
      context.fillRect(x, y, width, height);
    }
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
  renderMinecraftPattern(context, texture, composition);
  renderSurfaceDetails(context, composition);
  renderCanvasDetails(context, composition);
  return canvas;
};
