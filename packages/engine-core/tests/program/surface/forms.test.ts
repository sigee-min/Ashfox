import assert from 'node:assert/strict';

import { canonicalJsonString } from '../../../src/canonicalJson';
import { compileIntentProgram } from '../../../src/compiler/program';
import { materializeIntentProgram } from '../../../src/compiler/program/materialize';
import type { ProjectDocument } from '../../../src/model';
import { createProjectDocument } from '../../../src/project/create';
import {
  parseIntentProgram,
  type IntentProgramForwardDirection,
  type IntentProgramSurface,
  type IntentProgramSurfaceEdge,
  type IntentProgramSurfaceTip
} from '../../../src/project/program';
import { intentProgramSource } from '../source';

interface FormFixture {
  readonly id: string;
  readonly surface: IntentProgramSurface;
}

const fixtures: readonly FormFixture[] = [{
  id: 'dorsal',
  surface: {
    id: 'dorsal', role: 'fin', cardinality: 'single', parent: 'torso',
    anchor: 'top', growth: 'up', lane: 'center',
    shape: {
      axis: 'longitudinal', span: 'medium', chord: 'broad', tip: 'pointed',
      offset: 'posterior', edge: 'convex'
    }
  }
}, {
  id: 'pectoral',
  surface: {
    id: 'fins', role: 'fin', cardinality: 'paired', parent: 'torso',
    anchor: 'sides', growth: 'outward', lane: 'center',
    shape: {
      axis: 'longitudinal', span: 'medium', chord: 'broad', tip: 'pointed',
      offset: 'posterior', edge: 'convex'
    }
  }
}, {
  id: 'caudal',
  surface: {
    id: 'tail', role: 'fin', cardinality: 'single', parent: 'torso',
    anchor: 'rear', growth: 'rearward', lane: 'center',
    shape: {
      axis: 'vertical', span: 'long', chord: 'broad', tip: 'forked',
      offset: 'center', edge: 'concave'
    }
  }
}, {
  id: 'manta',
  surface: {
    id: 'wings', role: 'wing', cardinality: 'paired', parent: 'torso',
    anchor: 'sides', growth: 'outward', lane: 'center',
    shape: {
      axis: 'longitudinal', span: 'long', chord: 'broad', tip: 'rounded',
      offset: 'posterior', edge: 'convex'
    }
  }
}, {
  id: 'insect',
  surface: {
    id: 'wings', role: 'sail', cardinality: 'paired', parent: 'torso',
    anchor: 'sides', growth: 'up', lane: 'center',
    shape: {
      axis: 'longitudinal', span: 'long', chord: 'narrow', tip: 'flared',
      offset: 'anterior', edge: 'concave'
    }
  }
}];

const appearance = {
  palette: 'ocean' as const,
  texture: {
    kind: 'mottle' as const, scale: 'broad' as const,
    density: 'balanced' as const, contrast: 'subtle' as const
  },
  seed: { kind: 'auto' as const },
  markings: []
};
const source = (
  fixture: FormFixture,
  forward: IntentProgramForwardDirection = 'north',
  surface = fixture.surface,
  marked = false
): string => intentProgramSource({
  name: fixture.id,
  track: 'essential',
  domain: 'organism',
  forward,
  symmetry: 'bilateral',
  support: { kind: 'none', contacts: [] },
  body: [{ id: 'torso', kind: 'core', cardinality: 'single' }],
  surfaces: [surface],
  face: { kind: 'none' },
  idle: { mode: 'still' },
  appearance: marked ? {
    ...appearance,
    seed: { kind: 'explicit', value: 'reef-fin' },
    markings: [{
      id: 'tips', target: { kind: 'surface', id: surface.id },
      region: 'full', placement: 'tip', motif: 'patch', tone: 'accent',
      scale: 'medium', density: 'sparse', contrast: 'bold'
    }]
  } : appearance
});

const compile = (value: string) => {
  const parsed = parseIntentProgram(value);
  assert.deepEqual(parsed.diagnostics, []);
  const result = compileIntentProgram({
    program: parsed.ir!, sourceMap: parsed.sourceMap
  });
  if (!result.ok) throw new Error(result.diagnostics[0]?.message);
  return result.plan;
};
const materialize = (value: string, id: string): ProjectDocument => {
  const parsed = parseIntentProgram(value);
  assert.deepEqual(parsed.diagnostics, []);
  const result = materializeIntentProgram(createProjectDocument({
    id, name: id, revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source: value, hash: parsed.hash! });
  if (!result.ok) throw new Error(`${id}: ${result.error.message}`);
  return result.document;
};

for (const forward of ['north', 'south', 'east', 'west'] as const) {
  for (const fixture of fixtures) {
    const value = source(fixture, forward);
    const plan = compile(value);
    const document = materialize(value, `${fixture.id}-${forward}`);
    const surface = plan.compilation.surfaces[0];
    assert.ok(surface?.shape);
    assert.ok(document.authoringProfile?.slots.some((slot) =>
      slot.span.kind === 'supported-surface' &&
      slot.span.obligationId === surface.id
    ));
    if (surface.cardinality === 'paired') assert.ok(
      plan.attachmentReflections.some((entry) =>
        entry.sourcePartId.startsWith(`surface.${surface.id}.left.`)
      )
    );
    if (fixture.id === 'pectoral') {
      const planes = plan.recipe.parts.flatMap((part) =>
        part.kind === 'plate' && part.partId.includes('.membrane.')
          ? [part.plane]
          : []
      );
      assert.ok(planes.length > 0 && planes.every((plane) => plane === 'xz'));
    }
  }
}

const planShape = (
  tip: IntentProgramSurfaceTip,
  edge: IntentProgramSurfaceEdge
) => {
  const base = fixtures[0]!.surface;
  const fixture: FormFixture = {
    id: `${tip}-${edge}`,
    surface: {
      ...base,
      id: 'form',
      shape: {
        axis: 'longitudinal', span: 'long', chord: 'broad', tip,
        offset: 'center', edge
      }
    }
  };
  const planned = compile(source(fixture)).compilation.surfaces[0]?.shape;
  assert.ok(planned);
  return planned;
};
const tips = (['pointed', 'rounded', 'flat', 'flared', 'forked'] as const)
  .map((tip) => canonicalJsonString(planShape(tip, 'straight').membranes));
assert.equal(new Set(tips).size, tips.length);
const edges = (['straight', 'convex', 'concave'] as const)
  .map((edge) => canonicalJsonString(planShape('flat', edge).stations));
assert.equal(new Set(edges).size, edges.length);

const fork = planShape('forked', 'concave');
assert.ok(fork.fork);
const lobes = fork.membranes.slice(-2);
assert.equal(lobes.length, 2);
assert.equal(lobes[0]?.parentId, lobes[1]?.parentId);
const tipCross = lobes.flatMap((region) => region.outline
  .filter((point) => point.along === fork.spanLength)
  .map((point) => point.cross));
assert.ok(tipCross.length === 4 && tipCross.every((value) => Math.abs(value) >= 1));

const shared = fixtures[1]!;
const finPlan = compile(source(shared));
const wingPlan = compile(source(shared, 'north', {
  ...shared.surface,
  role: 'wing'
}));
const withoutMaterial = (plan: typeof finPlan) => plan.recipe.parts.map(
  ({ materialId: _materialId, ...geometry }) => geometry
);
assert.equal(
  canonicalJsonString(withoutMaterial(finPlan)),
  canonicalJsonString(withoutMaterial(wingPlan))
);
assert.notEqual(
  canonicalJsonString(finPlan.recipe.parts),
  canonicalJsonString(wingPlan.recipe.parts)
);

const markedDocument = materialize(source(shared, 'north', shared.surface, true),
  'marked-shaped-fin');
const binding = markedDocument.intent?.appearanceBindings?.find((entry) =>
  entry.markingId === 'tips'
);
const membraneIds = markedDocument.authoringProfile?.slots
  .filter((slot) => slot.span.kind === 'supported-surface')
  .flatMap((slot) => slot.span.kind === 'supported-surface'
    ? slot.span.membranes.flatMap((entry) => entry.partIds)
    : []) ?? [];
assert.ok(membraneIds.length > 2);
assert.ok(membraneIds.every((partId) => binding?.partIds.includes(partId)));
