import type {
  ProjectDocument,
  TextureAsset
} from '../../model';
import { parseSurfaceColor } from '../appearance/color';
import { generatedSurfacePixel } from '../appearance/pixel';
import type { RgbColor } from '../pixelRectShade';
import { composeTextureRaster } from './composition';
import { GENERATED_ATLAS_MAX_RESOLUTION } from './surfaceMetrics';

export interface CanonicalRgbaBytes extends ArrayLike<number> {
  readonly [index: number]: number;
}

export interface CanonicalTextureRaster {
  readonly width: number;
  readonly height: number;
  readonly rgba: CanonicalRgbaBytes;
}

const writePixel = (
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RgbColor
): void => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  rgba[offset] = color.r;
  rgba[offset + 1] = color.g;
  rgba[offset + 2] = color.b;
  rgba[offset + 3] = 255;
};

const fill = (
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  fillWidth: number,
  fillHeight: number,
  color: RgbColor
): void => {
  for (let targetY = y; targetY < y + fillHeight; targetY += 1) {
    for (let targetX = x; targetX < x + fillWidth; targetX += 1) {
      writePixel(rgba, width, height, targetX, targetY, color);
    }
  }
};

export const rasterizeTexture = (
  document: ProjectDocument,
  texture: TextureAsset
): CanonicalTextureRaster => {
  if (
    !Number.isSafeInteger(texture.width) ||
    !Number.isSafeInteger(texture.height) ||
    texture.width < 1 ||
    texture.height < 1 ||
    texture.width > GENERATED_ATLAS_MAX_RESOLUTION ||
    texture.height > GENERATED_ATLAS_MAX_RESOLUTION
  ) {
    throw new RangeError(
      `Canonical texture dimensions must be safe integers from 1 to ` +
        `${GENERATED_ATLAS_MAX_RESOLUTION}.`
    );
  }
  const composition = composeTextureRaster(document, texture);
  const rgba = new Uint8Array(texture.width * texture.height * 4);
  fill(
    rgba,
    texture.width,
    texture.height,
    0,
    0,
    texture.width,
    texture.height,
    parseSurfaceColor(composition.background ??
      String(texture.metadata?.previewColor ?? '#8e98a3'))
  );
  if (composition.generated) {
    for (const region of composition.regions) {
      for (
        let localY = -composition.gutter;
        localY < region.height + composition.gutter;
        localY += 1
      ) {
        for (
          let localX = -composition.gutter;
          localX < region.width + composition.gutter;
          localX += 1
        ) {
          const sourceX = Math.min(region.width - 1, Math.max(0, localX));
          const sourceY = Math.min(region.height - 1, Math.max(0, localY));
          writePixel(
            rgba,
            texture.width,
            texture.height,
            region.x + localX,
            region.y + localY,
            generatedSurfacePixel(region, sourceX, sourceY)
          );
        }
      }
    }
  }
  for (const detail of composition.canvasDetails) {
    fill(
      rgba,
      texture.width,
      texture.height,
      detail.x,
      detail.y,
      detail.width,
      detail.height,
      parseSurfaceColor(detail.color)
    );
  }
  return Object.freeze({
    width: texture.width,
    height: texture.height,
    rgba
  });
};
