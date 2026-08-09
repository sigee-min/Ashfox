import type { RgbColor } from '../pixelRectShade';
import { parseSurfaceColor } from './color';
import { generatedSurfaceToneRole } from './field';
import { generatedSurfaceTonePalette } from './palette';
import { surfaceMarkingAt } from './marks';
import { selectedSurfaceMarkingAt } from './budget';
import { paintFeatureMotifPixel } from '../featureMotif';
import type {
  GeneratedSurfacePattern
} from './authority';
import type { TextureCompositionRegion } from '../textureRecipe/types';

const generatedPatternPixel = (
  pattern: GeneratedSurfacePattern,
  color: RgbColor,
  face: TextureCompositionRegion['face'],
  x: number,
  y: number
): RgbColor => {
  const role = generatedSurfaceToneRole(
    pattern.toneField,
    pattern.origin[0] + x,
    pattern.origin[1] + y
  );
  return generatedSurfaceTonePalette(
    color,
    face,
    pattern.toneField.appearance.texture.contrast
  )[role];
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
      const color = parseSurfaceColor(marking.color);
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
      markedBase = generatedSurfaceTonePalette(
        color,
        region.face,
        'subtle'
      ).base;
      continue;
    }
    const motifPixel = paintFeatureMotifPixel(
      marking.motif,
      parseSurfaceColor(marking.color),
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

const semanticSurfacePixel = (
  region: TextureCompositionRegion,
  materialPixel: RgbColor,
  x: number,
  y: number
): RgbColor => {
  const pattern = region.pattern;
  if (!pattern) return materialPixel;
  const u = pattern.origin[0] + x;
  const v = pattern.origin[1] + y;
  const marking = pattern.toneField.markingMasks === undefined
    ? surfaceMarkingAt(pattern.toneField.appearance, u, v)
    : selectedSurfaceMarkingAt(pattern.toneField.markingMasks, u, v);
  if (!marking) return materialPixel;
  if (marking.tone === 'accent') {
    return marking.accentColor === null
      ? materialPixel
      : generatedSurfaceTonePalette(
          parseSurfaceColor(marking.accentColor),
          region.face,
          marking.contrast
        ).base;
  }
  const palette = generatedSurfaceTonePalette(
    parseSurfaceColor(region.color),
    region.face,
    marking.contrast
  );
  return marking.tone === 'lighter' ? palette.light : palette.shadow;
};

const composedSurfacePixel = (
  region: TextureCompositionRegion,
  materialPixel: RgbColor,
  x: number,
  y: number
): RgbColor => markedSurfacePixel(
  region,
  semanticSurfacePixel(region, materialPixel, x, y),
  x,
  y
);

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
    return composedSurfacePixel(
      region,
      generatedSurfaceTonePalette(
        parseSurfaceColor(region.color),
        region.face,
        'subtle'
      ).base,
      x,
      y
    );
  }
  return composedSurfacePixel(
    region,
    generatedPatternPixel(
      pattern,
      parseSurfaceColor(region.color),
      region.face,
      x,
      y
    ),
    x,
    y
  );
};
