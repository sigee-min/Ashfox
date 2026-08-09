import assert from 'node:assert/strict';

import { materializeIntentProgram } from '../../../src/compiler/program';
import type { ProjectDocument } from '../../../src/model';
import type {
  ProjectAppearanceBinding,
  ProjectAppearanceMarking
} from '../../../src/project/appearance/contract';
import { createProjectDocument } from '../../../src/project/create';
import { parseIntentProgram } from '../../../src/project/program';
import {
  SURFACE_APPEARANCE_VERSION,
  buildGeneratedSurfaceToneField,
  generatedSurfaceToneRole,
  selectedSurfaceMarkingAt,
  surfaceMarkingAt,
  surfaceMarkingContains,
  type GeneratedSurfaceToneField,
  type SurfaceAppearanceMarkingPlan,
  type SurfaceAppearanceV1
} from '../../../src/textures/appearance';
import {
  buildSurfacePatternComponents,
  type SurfacePatternComponent
} from '../../../src/textures/appearance/components';
import {
  compileTextureSurfaceAuthority
} from '../../../src/textures/textureRecipe/surfaceMetrics';

const sourceFor = (seed: string): string => [
  'metadata {',
  '  name "Appearance streams"',
  '  track hero',
  '  domain organism',
  '}',
  'model {',
  '  orientation forward south',
  '  symmetry bilateral',
  '  support none',
  '  body {',
  '    core torso',
  '    mass head single parent torso anchor front growth forward lane center',
  '  }',
  '  surface fins paired fin parent torso anchor sides growth outward lane center',
  '  face {',
  '    full parent head',
  '    eyes paired gaze center',
  '    nose absent',
  '    mouth neutral',
  '  }',
  '}',
  'animation {',
  '  idle breathe',
  '}',
  'appearance {',
  '  palette ocean',
  '  texture mottle scale broad density balanced contrast subtle',
  `  seed ${seed}`,
  '  mark belly target body torso region ventral placement whole as wash tone lighter scale broad density sparse contrast subtle',
  '  mark face-coat target face region full placement whole as wash tone accent scale broad density sparse contrast subtle',
  '  mark fin-dots target surface fins region full placement whole as spots tone darker scale medium density balanced contrast subtle',
  '}'
].join('\n');

const materialized = (source: string, id: string): ProjectDocument => {
  const parsed = parseIntentProgram(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.ok(parsed.hash);
  const result = materializeIntentProgram(createProjectDocument({
    id,
    name: id,
    revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source, hash: parsed.hash });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const appearanceParts = (document: ProjectDocument): {
  readonly markings: readonly ProjectAppearanceMarking[];
  readonly bindings: readonly ProjectAppearanceBinding[];
} => {
  const appearance = document.intent?.appearance;
  const bindings = document.intent?.appearanceBindings;
  if (!appearance || !bindings) throw new Error('Missing appearance fixture.');
  return { markings: appearance.markings, bindings };
};

const revisedAppearance = (
  document: ProjectDocument,
  markings: readonly ProjectAppearanceMarking[],
  bindings: readonly ProjectAppearanceBinding[]
): ProjectDocument => {
  const intent = document.intent;
  const appearance = intent?.appearance;
  if (!intent || !appearance) throw new Error('Missing intent fixture.');
  return {
    ...document,
    intent: {
      ...intent,
      appearance: {
        ...appearance,
        markings
      },
      appearanceBindings: bindings
    }
  };
};

interface StreamSnapshot {
  readonly material: readonly string[];
  readonly masks: Readonly<Record<string, readonly string[]>>;
  readonly seeds: Readonly<Record<string, readonly number[]>>;
}

const streamSnapshot = (document: ProjectDocument): StreamSnapshot => {
  const authority = compileTextureSurfaceAuthority(document);
  const material: string[] = [];
  const masks = new Map<string, string[]>();
  const seeds = new Map<string, number[]>();
  for (const [faceKey, face] of [...authority.faces].sort()) {
    const field = face.pattern?.toneField;
    if (!field) continue;
    material.push(
      `${faceKey}|${field.shadowKeys.join(';')}|${field.lightKeys.join(';')}`
    );
    for (const marking of field.appearance.markings ?? []) {
      const markingMasks = masks.get(marking.id) ?? [];
      for (let v = field.bounds.y; v < field.bounds.y + field.bounds.height; v += 1) {
        for (let u = field.bounds.x; u < field.bounds.x + field.bounds.width; u += 1) {
          if (surfaceMarkingContains(field.appearance, marking, u, v)) {
            markingMasks.push(`${faceKey}:${u},${v}`);
          }
        }
      }
      masks.set(marking.id, markingMasks);
      const markingSeeds = seeds.get(marking.id) ?? [];
      markingSeeds.push(marking.maskSeed);
      seeds.set(marking.id, markingSeeds);
    }
  }
  return {
    material,
    masks: Object.fromEntries([...masks].sort().map(([id, keys]) => [
      id,
      keys.sort()
    ])),
    seeds: Object.fromEntries([...seeds].sort().map(([id, values]) => [
      id,
      values.sort((left, right) => left - right)
    ]))
  };
};

const assertCommonMarkings = (
  base: StreamSnapshot,
  changed: StreamSnapshot,
  ids: readonly string[]
): void => {
  assert.deepEqual(changed.material, base.material);
  for (const id of ids) {
    assert.deepEqual(changed.masks[id], base.masks[id], `${id} mask moved`);
    assert.deepEqual(changed.seeds[id], base.seeds[id], `${id} seed moved`);
  }
};

for (const seed of ['auto', 'reef-alpha']) {
  const base = materialized(sourceFor(seed), `stream-${seed}`);
  const parts = appearanceParts(base);
  const snapshot = streamSnapshot(base);
  const variant = revisedAppearance(
    base,
    parts.markings.map((marking) => marking.id === 'belly'
      ? { ...marking, variant: 'winter' }
      : marking),
    parts.bindings
  );
  const variantSnapshot = streamSnapshot(variant);
  assertCommonMarkings(snapshot, variantSnapshot, ['face-coat', 'fin-dots']);
  assert.notDeepEqual(variantSnapshot.seeds.belly, snapshot.seeds.belly);

  const belly = parts.markings.find((marking) => marking.id === 'belly');
  const bellyBinding = parts.bindings.find(
    (binding) => binding.markingId === 'belly'
  );
  assert.ok(belly && bellyBinding);
  const addedMark: ProjectAppearanceMarking = {
    ...belly,
    id: 'crown-rim',
    region: 'dorsal',
    placement: 'edge',
    motif: 'rim'
  };
  const added = revisedAppearance(
    base,
    [...parts.markings, addedMark],
    [...parts.bindings, { ...bellyBinding, markingId: addedMark.id }]
  );
  assertCommonMarkings(snapshot, streamSnapshot(added), [
    'belly', 'face-coat', 'fin-dots'
  ]);

  const removed = revisedAppearance(
    base,
    parts.markings.filter((marking) => marking.id !== 'face-coat'),
    parts.bindings.filter((binding) => binding.markingId !== 'face-coat')
  );
  assertCommonMarkings(snapshot, streamSnapshot(removed), [
    'belly', 'fin-dots'
  ]);

  const reordered = revisedAppearance(
    base,
    [...parts.markings].reverse(),
    [...parts.bindings].reverse()
  );
  assert.deepEqual(streamSnapshot(reordered), snapshot);
}

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
  if (!value) throw new Error('Missing appearance budget component.');
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

const plan = (
  id: string,
  motif: SurfaceAppearanceMarkingPlan['motif'],
  seed: number
): SurfaceAppearanceMarkingPlan => ({
  id,
  target: { kind: 'body', id: 'body' },
  region: 'full',
  placement: 'whole',
  motif,
  tone: 'darker',
  ...(motif === 'band' || motif === 'stripe' || motif === 'bars'
    ? { flow: 'longitudinal' as const }
    : {}),
  scale: 'broad',
  density: 'rich',
  contrast: 'bold',
  accentColor: null,
  maskSeed: seed,
  frame,
  rootPoints: [],
  reflection: null
});

const appearance = (
  markings: readonly SurfaceAppearanceMarkingPlan[],
  overrides: Partial<SurfaceAppearanceV1> = {}
): SurfaceAppearanceV1 => ({
  version: SURFACE_APPEARANCE_VERSION,
  seed: { kind: 'explicit', value: 'aggregate' },
  semanticOwnerKey: 'body',
  domain: 'organism',
  texture: {
    kind: 'mottle',
    scale: 'broad',
    density: 'rich',
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
  tonePolicy: 'regular',
  ...overrides
});

const finalMarkingKeys = (
  field: GeneratedSurfaceToneField
): ReadonlyMap<string, readonly string[]> => new Map(
  (field.markingMasks ?? []).map((mask) => [mask.marking.id, mask.keys])
);

const connectedSizes = (keys: readonly string[]): readonly number[] => {
  const remaining = new Set(keys);
  const sizes: number[] = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value as string;
    const pending = [start];
    remaining.delete(start);
    let size = 0;
    while (pending.length > 0) {
      const key = pending.pop();
      if (!key) continue;
      size += 1;
      const [u = 0, v = 0] = key.split(',').map(Number);
      for (const neighbor of [
        `${u - 1},${v}`,
        `${u + 1},${v}`,
        `${u},${v - 1}`,
        `${u},${v + 1}`
      ]) {
        if (!remaining.delete(neighbor)) continue;
        pending.push(neighbor);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((left, right) => right - left);
};

const stackedPlans = [
  plan('broad-wash', 'wash', 8101),
  plan('broad-band', 'band', 8102),
  plan('rich-spots', 'spots', 8103),
  plan('edge-rim', 'rim', 8104)
];
const surface = component();
const stackedAppearance = appearance(stackedPlans);
const raw = new Set<string>();
for (let v = 0; v < 32; v += 1) for (let u = 0; u < 32; u += 1) {
  if (surfaceMarkingAt(stackedAppearance, u, v)) raw.add(`${u},${v}`);
}
assert.ok(raw.size > surface.texelCount * 0.35);

const stackedField = buildGeneratedSurfaceToneField(
  surface,
  stackedAppearance
);
const semantic = new Set((stackedField.markingMasks ?? []).flatMap(
  (mask) => mask.keys
));
const material = new Set([
  ...stackedField.shadowKeys,
  ...stackedField.lightKeys
]);
const combined = new Set([...semantic, ...material]);
assert.ok(semantic.size <= Math.floor(surface.texelCount * 0.35));
assert.ok(combined.size < surface.texelCount * 0.5);
assert.deepEqual(
  new Set((stackedField.markingMasks ?? []).map((mask) => mask.marking.id)),
  new Set(stackedPlans.map((marking) => marking.id)),
  'the exact cap must retain every semantic marking class'
);

const reversedField = buildGeneratedSurfaceToneField(
  surface,
  appearance([...stackedPlans].reverse())
);
assert.deepEqual(finalMarkingKeys(reversedField), finalMarkingKeys(stackedField));

const styledField = buildGeneratedSurfaceToneField(surface, appearance(
  stackedPlans.map((marking) => ({
    ...marking,
    contrast: 'subtle',
    accentColor: '#E6A45C'
  })),
  { texture: { ...stackedAppearance.texture, contrast: 'bold' } }
));
assert.deepEqual(finalMarkingKeys(styledField), finalMarkingKeys(stackedField));
assert.deepEqual(styledField.shadowKeys, stackedField.shadowKeys);
assert.deepEqual(styledField.lightKeys, stackedField.lightKeys);

const topologyPlans = [
  plan('topology-wash', 'wash', 8301),
  plan('topology-band', 'band', 8302),
  plan('z-bars', 'bars', 8304),
  plan('topology-patch', 'patch', 8305)
];
const topologyAppearance = appearance(topologyPlans);
const topologyRaw = new Set<string>();
for (let v = 0; v < 32; v += 1) for (let u = 0; u < 32; u += 1) {
  if (surfaceMarkingAt(topologyAppearance, u, v)) {
    topologyRaw.add(`${u},${v}`);
  }
}
assert.ok(topologyRaw.size > surface.texelCount * 0.35);
const topologyField = buildGeneratedSurfaceToneField(
  surface,
  topologyAppearance
);
const topologyMasks = finalMarkingKeys(topologyField);
const topologyBounds: Readonly<Record<string, number>> = {
  'topology-wash': 5,
  'topology-band': 5,
  'z-bars': 4,
  'topology-patch': 1
};
for (const [id, maximumComponents] of Object.entries(topologyBounds)) {
  const keys = topologyMasks.get(id) ?? [];
  const sizes = connectedSizes(keys);
  assert.ok(keys.length > 0, `${id} disappeared under the bound compositor`);
  assert.ok(
    sizes.length <= maximumComponents,
    `${id} fragmented into ${sizes.length} raster components`
  );
  if (id === 'topology-wash' || id === 'topology-patch') {
    assert.ok(
      (sizes[0] ?? 0) / keys.length >= 0.75,
      `${id} must remain a compact dominant island after composition`
    );
  }
}

const stripePlans = [
  plan('stripe-wash', 'wash', 8401),
  plan('bounded-stripe', 'stripe', 8402),
  plan('stripe-spots', 'spots', 8403),
  plan('stripe-rim', 'rim', 8404)
];
const stripeAppearance = appearance(stripePlans);
const stripeRaw = new Set<string>();
for (let v = 0; v < 32; v += 1) for (let u = 0; u < 32; u += 1) {
  if (surfaceMarkingAt(stripeAppearance, u, v)) stripeRaw.add(`${u},${v}`);
}
assert.ok(stripeRaw.size > surface.texelCount * 0.35);
const stripeField = buildGeneratedSurfaceToneField(surface, stripeAppearance);
const stripeKeys = finalMarkingKeys(stripeField).get('bounded-stripe') ?? [];
assert.ok(stripeKeys.length > 0);
assert.ok(
  connectedSizes(stripeKeys).length <= 5,
  'a bounded stripe cannot become salt-and-pepper after final composition'
);

for (const motif of [
  'wash', 'band', 'stripe', 'bars', 'spots', 'patch', 'rim'
] as const) {
  const marking = {
    ...plan(`single-${motif}`, motif, 9200 + motif.length),
    scale: 'medium' as const,
    density: 'balanced' as const
  };
  const singleAppearance = appearance([marking], {
    texture: {
      ...stackedAppearance.texture,
      density: 'balanced'
    }
  });
  const singleField = buildGeneratedSurfaceToneField(surface, singleAppearance);
  let rawCount = 0;
  let selectedCount = 0;
  for (let v = 0; v < 32; v += 1) for (let u = 0; u < 32; u += 1) {
    rawCount += Number(surfaceMarkingContains(singleAppearance, marking, u, v));
    selectedCount += Number(selectedSurfaceMarkingAt(
      singleField.markingMasks ?? [],
      u,
      v
    ) !== null);
  }
  assert.equal(selectedCount, rawCount, `${motif} single-mark shape was clipped`);
}

const protectedField = buildGeneratedSurfaceToneField(surface, appearance(
  stackedPlans,
  { protectedRegions: [{ x: 10, y: 10, width: 4, height: 4 }] }
));
for (let v = 9; v < 15; v += 1) for (let u = 9; u < 15; u += 1) {
  assert.equal(generatedSurfaceToneRole(protectedField, u, v), 'base');
  assert.equal(selectedSurfaceMarkingAt(
    protectedField.markingMasks ?? [],
    u,
    v
  ), null);
}
