import {
  shadeMinecraftPixel,
  type RgbColor,
  type TextureAsset
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

const renderMinecraftPattern = (
  context: CanvasRenderingContext2D,
  texture: TextureAsset
): void => {
  const pattern = texture.raster?.pattern;
  if (!pattern) return;
  const image = context.getImageData(0, 0, texture.width, texture.height);
  for (const region of pattern.regions) {
    const color = rgbColor(region.color);
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
            intensity: pattern.intensity,
            edge: pattern.edge,
            noise: pattern.noise,
            seed: region.seed,
            lightDir: pattern.lightDir
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

export const renderTextureRaster = (
  texture: TextureAsset
): HTMLCanvasElement => {
  const canvas = window.document.createElement('canvas');
  canvas.width = texture.width;
  canvas.height = texture.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Texture canvas is unavailable.');

  context.fillStyle = texture.raster?.background ?? previewColor(texture);
  context.fillRect(0, 0, texture.width, texture.height);
  for (const rectangle of texture.raster?.rectangles ?? []) {
    context.fillStyle = rectangle.color;
    context.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height
    );
  }
  renderMinecraftPattern(context, texture);
  return canvas;
};
