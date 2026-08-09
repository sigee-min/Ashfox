import { stableTextureSeed } from './deterministicPixel';
import {
  DEFAULT_GENERATED_TONE_CUTOFFS,
  generatedToneScore,
  type GeneratedToneCutoffs
} from './generatedPixelShade';
import {
  DEFAULT_PIXEL_SHADE_STYLE,
  type PixelShadeConfig
} from './pixelRectShade';
import { FOCAL_PIXEL_SHADE_STYLE } from './pixelSurfacePattern';
import type {
  SurfacePatternComponent
} from './surfacePatternComponents';

const GENERATED_SURFACE_SEED = 0x41534846;
const SHADE_ROLE_SHARE = 0.25;

export type GeneratedSurfaceTonePolicy = 'regular' | 'focal';

export interface GeneratedSurfaceToneField {
  config: PixelShadeConfig;
  cutoffs: GeneratedToneCutoffs;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const toneConfig = (
  policy: GeneratedSurfaceTonePolicy,
  seed: number
): PixelShadeConfig => ({
  ...(policy === 'focal'
    ? FOCAL_PIXEL_SHADE_STYLE
    : DEFAULT_PIXEL_SHADE_STYLE),
  seed
});

const componentScores = (
  component: SurfacePatternComponent,
  rect: GeneratedSurfaceToneField['rect'],
  config: PixelShadeConfig
): Float64Array => {
  const scores = new Float64Array(component.texelCount);
  let index = 0;
  for (const span of component.occupiedSpans) {
    for (let x = span.x; x < span.x + span.width; x += 1) {
      scores[index] = generatedToneScore(
        x - component.bounds.x,
        span.y - component.bounds.y,
        rect,
        config
      );
      index += 1;
    }
  }
  return scores;
};

const quantileCutoffs = (
  scores: Float64Array
): GeneratedToneCutoffs => {
  if (scores.length <= 4) return DEFAULT_GENERATED_TONE_CUTOFFS;
  scores.sort();
  const roleCount = Math.max(
    1,
    Math.ceil(scores.length * SHADE_ROLE_SHARE)
  );
  return Object.freeze({
    shadowMax: scores[roleCount - 1],
    lightMin: scores[scores.length - roleCount]
  });
};

export const buildGeneratedSurfaceToneField = (
  component: SurfacePatternComponent,
  policy: GeneratedSurfaceTonePolicy
): GeneratedSurfaceToneField => {
  const rect = Object.freeze({
    x: 0,
    y: 0,
    width: component.bounds.width,
    height: component.bounds.height
  });
  const config = Object.freeze(toneConfig(
    policy,
    stableTextureSeed(component.seedKey, GENERATED_SURFACE_SEED)
  ));
  return Object.freeze({
    config,
    cutoffs: quantileCutoffs(componentScores(component, rect, config)),
    rect
  });
};
