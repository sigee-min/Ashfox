import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  SURFACE_APPEARANCE_VERSION,
  buildGeneratedSurfaceToneField,
  generatedSurfaceToneRole,
  type GeneratedSurfaceToneField,
  type SurfaceAppearanceV1,
  type SurfaceDecorationProfile,
  type SurfaceTextureContrast
} from '../../../src/textures/appearance';
import {
  buildSurfacePatternComponents,
  type SurfacePatternComponent,
  type SurfacePatternDraft
} from '../../../src/textures/appearance/components';

const componentFor = (
  drafts: readonly SurfacePatternDraft[]
): SurfacePatternComponent => {
  const unique = [...new Set(buildSurfacePatternComponents(drafts).values())];
  assert.equal(unique.length, 1, 'test shape must be one surface component');
  const component = unique[0];
  if (!component) throw new Error('Missing test surface component.');
  return component;
};

const rectangle = (
  width: number,
  height: number,
  ownerKey = 'body'
): SurfacePatternComponent => componentFor([{
  id: 'surface',
  ownerKey,
  groupKey: `surface:${ownerKey}`,
  x: 0,
  y: 0,
  width,
  height
}]);

const appearance = (
  overrides: Partial<SurfaceAppearanceV1> = {}
): SurfaceAppearanceV1 => ({
  version: SURFACE_APPEARANCE_VERSION,
  seed: { kind: 'explicit', value: 'field-seed' },
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
  frame: {
    forward: [0, 0, 1],
    left: [1, 0, 0],
    up: [0, 1, 0],
    lateralRange: { minimum: 0, maximum: 32 },
    upRange: { minimum: -32, maximum: 0 },
    forwardRange: { minimum: 0, maximum: 32 }
  },
  tonePolicy: 'regular',
  ...overrides
});

const roleKeys = (field: GeneratedSurfaceToneField): readonly string[] =>
  [...field.shadowKeys, ...field.lightKeys].sort();

const roleCounts = (
  component: SurfacePatternComponent,
  field: GeneratedSurfaceToneField
): { readonly base: number; readonly shadow: number; readonly light: number } => {
  const counts = { base: 0, shadow: 0, light: 0 };
  for (const span of component.occupiedSpans) {
    for (let u = span.x; u < span.x + span.width; u += 1) {
      counts[generatedSurfaceToneRole(field, u, span.y)] += 1;
    }
  }
  return counts;
};

const variedClusters = (
  field: GeneratedSurfaceToneField
): readonly { readonly size: number; readonly bridges: boolean }[] => {
  const varied = new Set(roleKeys(field));
  const visited = new Set<string>();
  const maximumX = field.bounds.x + field.bounds.width - 1;
  const maximumY = field.bounds.y + field.bounds.height - 1;
  const clusters: { size: number; bridges: boolean }[] = [];
  for (const start of varied) {
    if (visited.has(start)) continue;
    const pending = [start];
    visited.add(start);
    let size = 0;
    let left = false;
    let right = false;
    let top = false;
    let bottom = false;
    while (pending.length > 0) {
      const key = pending.pop();
      if (!key) continue;
      size += 1;
      const [u = 0, v = 0] = key.split(',').map(Number);
      left ||= u === field.bounds.x;
      right ||= u === maximumX;
      top ||= v === field.bounds.y;
      bottom ||= v === maximumY;
      for (const neighbor of [
        `${u - 1},${v}`,
        `${u + 1},${v}`,
        `${u},${v - 1}`,
        `${u},${v + 1}`
      ]) {
        if (varied.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    clusters.push({
      size,
      bridges:
        (field.bounds.width > 1 && left && right) ||
        (field.bounds.height > 1 && top && bottom)
    });
  }
  return clusters;
};

for (let texels = 1; texels <= 15; texels += 1) {
  const component = rectangle(texels, 1, `tiny-${texels}`);
  const field = buildGeneratedSurfaceToneField(component, appearance());
  const varied = roleKeys(field).length;
  assert.ok(
    varied <= (texels <= 4 ? 0 : texels <= 7 ? 1 : 2),
    `${texels}-texel surfaces must obey the exact tiny-feature budget`
  );
}

const profiles: readonly SurfaceDecorationProfile[] = [
  'body',
  'support',
  'focal',
  'fin',
  'panel'
];
for (const profile of profiles) {
  for (let seedIndex = 0; seedIndex < 12; seedIndex += 1) {
    const component = rectangle(32, 32, `${profile}-${seedIndex}`);
    const field = buildGeneratedSurfaceToneField(component, appearance({
      seed: { kind: 'explicit', value: `seed-${seedIndex}` },
      semanticOwnerKey: `${profile}-${seedIndex}`,
      decoration: profile,
      tonePolicy: profile === 'focal' ? 'focal' : 'regular'
    }));
    const counts = roleCounts(component, field);
    const baseShare = counts.base / component.texelCount;
    assert.ok(
      baseShare >= 0.7 && baseShare <= 0.9,
      `${profile}/${seedIndex} must remain base-dominant without flattening`
    );
    for (const cluster of variedClusters(field)) {
      assert.ok(
        cluster.size <= Math.floor(component.texelCount * 0.2),
        `${profile}/${seedIndex} varied islands must stay locally bounded`
      );
      assert.equal(
        cluster.bridges,
        false,
        `${profile}/${seedIndex} must not bisect a face between opposite edges`
      );
    }
  }
}

const whole = rectangle(32, 32, 'partition');
const split = componentFor([
  { id: 'nw', x: 0, y: 0, width: 16, height: 16 },
  { id: 'ne', x: 16, y: 0, width: 16, height: 16 },
  { id: 'sw', x: 0, y: 16, width: 16, height: 16 },
  { id: 'se', x: 16, y: 16, width: 16, height: 16 }
].map((draft) => ({
  ...draft,
  ownerKey: 'partition',
  groupKey: 'surface:partition'
})));
assert.deepEqual(split, whole, 'component authority must ignore cuboid splits');
assert.deepEqual(
  buildGeneratedSurfaceToneField(split, appearance()),
  buildGeneratedSurfaceToneField(whole, appearance()),
  'appearance mask must ignore cuboid splits'
);
assert.deepEqual(
  componentFor([
    { id: 'right', x: 16, y: 0, width: 16, height: 32 },
    { id: 'left', x: 0, y: 0, width: 16, height: 32 }
  ].map((draft) => ({
    ...draft,
    ownerKey: 'partition',
    groupKey: 'surface:partition'
  }))),
  whole,
  'component authority must ignore input member order'
);

const contrastMasks = (['subtle', 'medium', 'bold'] as const).map(
  (contrast: SurfaceTextureContrast) => roleKeys(
    buildGeneratedSurfaceToneField(whole, appearance({
      texture: { ...appearance().texture, contrast }
    }))
  )
);
assert.deepEqual(contrastMasks[0], contrastMasks[1]);
assert.deepEqual(contrastMasks[1], contrastMasks[2]);

const seededMasks = Array.from({ length: 6 }, (_, index) => roleKeys(
  buildGeneratedSurfaceToneField(whole, appearance({
    seed: { kind: 'explicit', value: `semantic-${index}` },
    semanticOwnerKey: `semantic-${index}`
  }))
));
assert.ok(
  new Set(seededMasks.map((mask) => JSON.stringify(mask))).size >= 5,
  'typed semantic identity and explicit seeds must create distinct masks'
);
const semanticMasks = (['body', 'support', 'fin', 'panel'] as const).map(
  (decoration) => JSON.stringify(roleKeys(buildGeneratedSurfaceToneField(
    whole,
    appearance({ decoration, semanticOwnerKey: 'shared-semantic-owner' })
  )))
);
assert.ok(
  new Set(semanticMasks).size >= 3,
  'typed decoration profiles must vary placement without ID-name inference'
);

const protectedField = buildGeneratedSurfaceToneField(whole, appearance({
  decoration: 'focal',
  tonePolicy: 'focal',
  protectedRegions: [{ x: 12, y: 12, width: 8, height: 6 }]
}));
for (let v = 11; v < 19; v += 1) {
  for (let u = 11; u < 21; u += 1) {
    assert.equal(
      generatedSurfaceToneRole(protectedField, u, v),
      'base',
      'feature footprints and their one-texel halo must retain the base role'
    );
  }
}
assert.ok(Object.isFrozen(protectedField));
assert.ok(Object.isFrozen(protectedField.bounds));
assert.ok(Object.isFrozen(protectedField.shadowKeys));
assert.ok(Object.isFrozen(protectedField.lightKeys));
assert.throws(() => (protectedField.shadowKeys as string[]).push('mutable'));

const largeComponent = rectangle(256, 256, 'performance');
const startedAt = performance.now();
buildGeneratedSurfaceToneField(largeComponent, appearance({
  semanticOwnerKey: 'performance'
}));
assert.ok(
  performance.now() - startedAt < 1_500,
  '256x256 appearance synthesis must remain comfortably sub-quadratic'
);
