import type { RgbColor } from './pixelRectShade';
import {
  generatedSurfaceTonePalette,
  generatedToneRole,
  generatedToneScore
} from './generatedPixelShade';
import {
  paintDirectionalFocalSurfacePixel,
  paintDirectionalSurfacePixel,
  paintFocalSurfacePixel,
  paintSurfacePixel
} from './pixelSurfacePattern';
import { paintFeatureMotifPixel } from './featureMotif';
import { stableTextureSeed } from './deterministicPixel';
import type {
  GeneratedSurfacePattern
} from './generatedSurfaceAuthority';
import type { TextureCompositionRegion } from './textureRecipe/types';

const rgbColor = (value: string): RgbColor => ({
  r: Number.parseInt(value.slice(1, 3), 16),
  g: Number.parseInt(value.slice(3, 5), 16),
  b: Number.parseInt(value.slice(5, 7), 16)
});

const generatedPatternPixel = (
  pattern: GeneratedSurfacePattern,
  color: RgbColor,
  face: TextureCompositionRegion['face'],
  x: number,
  y: number
): RgbColor => {
  const score = generatedToneScore(
    pattern.origin[0] + x - pattern.bounds.x,
    pattern.origin[1] + y - pattern.bounds.y,
    pattern.toneField.rect,
    pattern.toneField.config
  );
  return generatedSurfaceTonePalette(color, face)[
    generatedToneRole(score, pattern.toneField.cutoffs)
  ];
};

const markedSurfacePixel = (
  region: TextureCompositionRegion,
  base: RgbColor,
  x: number,
  y: number
): RgbColor => {
  let markedBase = base;
  for (const marking of region.markings ?? []) {
    if (
      x < marking.x ||
      y < marking.y ||
      x >= marking.x + marking.width ||
      y >= marking.y + marking.height
    ) {
      continue;
    }
    if (marking.motif === 'patch') {
      const color = rgbColor(marking.color);
      const pattern = region.pattern;
      if (pattern) {
        markedBase = generatedPatternPixel(
          pattern,
          color,
          region.face,
          x,
          y
        );
        continue;
      }
      markedBase = (region.tonePolicy === 'focal'
        ? paintDirectionalFocalSurfacePixel
        : paintDirectionalSurfacePixel)(
        color,
        region.face,
        marking.motifX + x - marking.x,
        marking.motifY + y - marking.y,
        marking.motifWidth,
        marking.motifHeight,
        stableTextureSeed(marking.id, 0x41534846)
      );
      continue;
    }
    const motifPixel = paintFeatureMotifPixel(
      marking.motif,
      rgbColor(marking.color),
      marking.motifX + x - marking.x,
      marking.motifY + y - marking.y,
      marking.motifWidth,
      marking.motifHeight,
      marking.glyph,
      marking.eyePupilBias
    );
    if (motifPixel) return motifPixel;
  }
  return markedBase;
};

/**
 * Final deterministic RGB authority for one generated surface texel.
 * Renderers consume this result and do not reinterpret tone distribution.
 */
export const generatedSurfacePixel = (
  region: TextureCompositionRegion,
  x: number,
  y: number
): RgbColor => {
  const pattern = region.pattern;
  if (!pattern) {
    return markedSurfacePixel(
      region,
      (region.tonePolicy === 'focal'
        ? paintFocalSurfacePixel
        : paintSurfacePixel)(
        rgbColor(region.color),
        x,
        y,
        region.width,
        region.height,
        stableTextureSeed(
          `${region.nodeId}:${region.face}`,
          0x41534846
        )
      ),
      x,
      y
    );
  }
  return markedSurfacePixel(
    region,
    generatedPatternPixel(
      pattern,
      rgbColor(region.color),
      region.face,
      x,
      y
    ),
    x,
    y
  );
};
