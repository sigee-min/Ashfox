import assert from 'node:assert/strict';

import {
  SURFACE_APPEARANCE_VERSION,
  buildGeneratedSurfaceToneField,
  generatedSurfaceTonePalette,
  generatedSurfaceToneRole,
  surfaceMarkingContains,
  type SurfaceAppearanceMarkingPlan,
  type SurfaceAppearanceV1
} from '../../../../src/textures/appearance';
import {
  buildSurfacePatternComponents,
  type SurfacePatternComponent
} from '../../../../src/textures/appearance/components';
import { parseSurfaceColor } from '../../../../src/textures/appearance/color';
import { generatedSurfacePixel } from '../../../../src/textures/appearance/pixel';
import { paintFeatureMotifPixel } from '../../../../src/textures/featureMotif';
import type {
  TextureCompositionRegion
} from '../../../../src/textures/textureRecipe/types';

const component = (): SurfacePatternComponent => {
  const value = buildSurfacePatternComponents([{
    id: 'face',
    ownerKey: 'body',
    groupKey: 'body:south',
    x: 0,
    y: 0,
    width: 32,
    height: 32
  }]).get('face');
  if (!value) throw new Error('Missing semantic marking test component.');
  return value;
};

const frame = {
  forward: [0, 0, 1],
  left: [1, 0, 0],
  up: [0, 1, 0],
  lateralRange: { minimum: 0, maximum: 32 },
  upRange: { minimum: -32, maximum: 0 },
  forwardRange: { minimum: 0, maximum: 32 }
} as const;

const planFor = (
  motif: SurfaceAppearanceMarkingPlan['motif'],
  maskSeed: number,
  overrides: Partial<SurfaceAppearanceMarkingPlan> = {}
): SurfaceAppearanceMarkingPlan => ({
  id: `mark-${motif}`,
  target: { kind: 'body', id: 'body' },
  region: 'full',
  placement: 'whole',
  motif,
  tone: 'darker',
  ...(motif === 'band' || motif === 'stripe' || motif === 'bars'
    ? { flow: 'longitudinal' as const }
    : {}),
  scale: 'medium',
  density: 'balanced',
  contrast: 'bold',
  accentColor: '#68B8C7',
  maskSeed,
  frame,
  rootPoints: [],
  reflection: null,
  ...overrides
});

const appearanceFor = (
  markings: readonly SurfaceAppearanceMarkingPlan[] = []
): SurfaceAppearanceV1 => ({
  version: SURFACE_APPEARANCE_VERSION,
  seed: { kind: 'explicit', value: 'mask-unit' },
  semanticOwnerKey: 'body',
  domain: 'organism',
  texture: {
    kind: 'mottle',
    scale: 'broad',
    density: 'balanced',
    contrast: 'subtle'
  },
  decoration: 'body',
  geometry: 'mass',
  faceDirection: 'south',
  faceAspect: 'anterior',
  plane: 16,
  attachmentPoints: [],
  protectedRegions: [],
  markings,
  frame,
  tonePolicy: 'regular'
});

for (const [index, motif] of [
  'wash', 'band', 'stripe', 'bars', 'spots', 'patch', 'rim'
].entries()) {
  const marking = planFor(
    motif as SurfaceAppearanceMarkingPlan['motif'],
    1701 + index
  );
  const appearance = appearanceFor([marking]);
  const field = buildGeneratedSurfaceToneField(component(), appearance);
  let marked = 0;
  let materialOrMarked = 0;
  for (let v = 0; v < 32; v += 1) {
    for (let u = 0; u < 32; u += 1) {
      const selected = surfaceMarkingContains(appearance, marking, u, v);
      marked += Number(selected);
      materialOrMarked += Number(
        selected || generatedSurfaceToneRole(field, u, v) !== 'base'
      );
    }
  }
  assert.ok(marked > 0, `${motif} must produce a local analytic mask`);
  assert.ok(marked < 32 * 32 * 0.35, `${motif} cannot create a 50:50 split`);
  assert.ok(
    materialOrMarked < 32 * 32 * 0.5,
    `${motif} plus material variation must remain base-dominant`
  );
}

for (const motif of ['band', 'stripe', 'bars'] as const) {
  const marking = planFor(motif, 6200 + motif.length, { flow: 'radial' });
  const appearance = appearanceFor([marking]);
  const selected = Array.from({ length: 32 * 32 }, (_, index) =>
    surfaceMarkingContains(
      appearance,
      marking,
      index % 32,
      Math.floor(index / 32)
    )
  ).filter(Boolean).length;
  assert.ok(
    selected > 0 && selected < 32 * 32 * 0.35,
    `${motif} radial flow must stay local (selected ${selected})`
  );
}

const selectedCount = (
  appearance: SurfaceAppearanceV1,
  marking: SurfaceAppearanceMarkingPlan
): number => Array.from({ length: 32 * 32 }, (_, index) =>
  surfaceMarkingContains(
    appearance,
    marking,
    index % 32,
    Math.floor(index / 32)
  )
).filter(Boolean).length;

const flankMark = planFor('wash', 7117, {
  region: 'flank',
  frame: {
    ...frame,
    upRange: { minimum: -32, maximum: 0 },
    forwardRange: { minimum: -32, maximum: 0 }
  }
});
assert.equal(
  selectedCount(appearanceFor([flankMark]), flankMark),
  0,
  'flank is a semantic region and cannot leak onto an anterior face'
);
const flankAppearance: SurfaceAppearanceV1 = {
  ...appearanceFor([flankMark]),
  faceDirection: 'east',
  faceAspect: 'flank'
};
assert.ok(selectedCount(flankAppearance, flankMark) > 0);

const transverseMark = planFor('bars', 7119, { flow: 'transverse' });
const longitudinalMark = { ...transverseMark, flow: 'longitudinal' as const };
assert.notDeepEqual(
  Array.from({ length: 32 * 32 }, (_, index) =>
    surfaceMarkingContains(
      appearanceFor([transverseMark]),
      transverseMark,
      index % 32,
      Math.floor(index / 32)
    )
  ),
  Array.from({ length: 32 * 32 }, (_, index) =>
    surfaceMarkingContains(
      appearanceFor([longitudinalMark]),
      longitudinalMark,
      index % 32,
      Math.floor(index / 32)
    )
  ),
  'transverse flow owns pattern direction independently of semantic region'
);

const haloMark = planFor('wash', 8801);
const haloAppearance = {
  ...appearanceFor([haloMark]),
  protectedRegions: [{ x: 10, y: 10, width: 4, height: 4 }]
};
for (let v = 9; v < 15; v += 1) for (let u = 9; u < 15; u += 1) {
  assert.equal(surfaceMarkingContains(haloAppearance, haloMark, u, v), false);
}

const localMark = planFor('patch', 9127);
const markedAppearance = appearanceFor([localMark]);
const markedField = buildGeneratedSurfaceToneField(component(), markedAppearance);
const plainField = buildGeneratedSurfaceToneField(component(), appearanceFor());
const regionFor = (
  field: typeof markedField,
  feature = false
): TextureCompositionRegion => ({
  nodeId: 'body-cube',
  face: 'south',
  tonePolicy: 'regular',
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  color: '#285E78',
  pattern: {
    seedKey: 'body:south',
    tonePolicy: 'regular',
    toneField: field,
    origin: [0, 0],
    bounds: field.bounds
  },
  ...(feature ? {
    markings: [{
      id: 'feature-eye',
      motif: 'eye',
      glyph: 'square',
      color: '#F4F6FA',
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      motifX: 0,
      motifY: 0,
      motifWidth: 32,
      motifHeight: 32
    }]
  } : {})
});
const markedRegion = regionFor(markedField);
const plainRegion = regionFor(plainField);
const markedPoint = Array.from({ length: 32 * 32 }, (_, index) => ({
  x: index % 32,
  y: Math.floor(index / 32)
})).find(({ x, y }) => surfaceMarkingContains(
  markedAppearance,
  localMark,
  x,
  y
));
assert.ok(markedPoint);
assert.deepEqual(
  generatedSurfacePixel(markedRegion, markedPoint.x, markedPoint.y),
  generatedSurfaceTonePalette(
    parseSurfaceColor(markedRegion.color),
    markedRegion.face,
    localMark.contrast
  ).shadow,
  'lighter/darker marks use compiler role projection after material variation'
);
assert.notDeepEqual(
  generatedSurfacePixel(markedRegion, markedPoint.x, markedPoint.y),
  generatedSurfacePixel(plainRegion, markedPoint.x, markedPoint.y)
);

const featureRegion = regionFor(markedField, true);
const featurePoint = Array.from({ length: 32 * 32 }, (_, index) => ({
  x: index % 32,
  y: Math.floor(index / 32)
})).find(({ x, y }) =>
  surfaceMarkingContains(markedAppearance, localMark, x, y) &&
  paintFeatureMotifPixel(
    'eye',
    parseSurfaceColor('#F4F6FA'),
    x,
    y,
    32,
    32,
    'square'
  ) !== null
);
assert.ok(featurePoint);
const expectedFeature = paintFeatureMotifPixel(
  'eye',
  parseSurfaceColor('#F4F6FA'),
  featurePoint.x,
  featurePoint.y,
  32,
  32,
  'square'
);
assert.ok(expectedFeature);
assert.deepEqual(
  generatedSurfacePixel(featureRegion, featurePoint.x, featurePoint.y),
  expectedFeature,
  'focal feature motifs must paint after every semantic marking class'
);

const reflectedPlan = planFor('spots', 4421, {
  frame: {
    ...frame,
    left: [-1, 0, 0],
    lateralRange: { minimum: 0, maximum: 16 }
  },
  reflection: { axis: 'x', planeTwice: 0, leftSign: -1 }
});
const reflectedAppearance = appearanceFor([reflectedPlan]);
const reflectionPairs = Array.from({ length: 16 * 32 }, (_, index) => {
  const leftU = -16 + index % 16;
  const v = Math.floor(index / 16);
  return [
    surfaceMarkingContains(reflectedAppearance, reflectedPlan, leftU, v),
    surfaceMarkingContains(reflectedAppearance, reflectedPlan, -leftU - 1, v)
  ] as const;
});
assert.ok(reflectionPairs.some(([selected]) => selected));
assert.ok(reflectionPairs.some(([selected]) => !selected));
assert.ok(
  reflectionPairs.every(([left, right]) => left === right),
  'semantic marking shape must be stable under the declared lateral reflection'
);
