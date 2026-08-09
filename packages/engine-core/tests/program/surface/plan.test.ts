import assert from 'node:assert/strict';

import { canonicalJsonString } from '../../../src/canonicalJson';
import { compileIntentProgram } from '../../../src/compiler/program';
import { planIntentProgram } from '../../../src/compiler/program/plan';
import { sha256Digest } from '../../../src/provenance/program';
import { parseIntentProgram } from '../../../src/project/program';
import type {
  IntentProgramIr,
  IntentProgramSurface
} from '../../../src/project/program/types';
import { intentProgramSource } from '../source';

const source = (surfaces: readonly IntentProgramSurface[]): string =>
  intentProgramSource({
    name: 'Planned surface',
    track: 'essential',
    domain: 'organism',
    forward: 'north',
    symmetry: 'bilateral',
    support: { kind: 'none', contacts: [] },
    body: [{ id: 'torso', kind: 'core', cardinality: 'single' }],
    surfaces,
    face: { kind: 'none' },
    idle: { mode: 'still' },
    appearance: {
      palette: 'ocean',
      texture: {
        kind: 'mottle', scale: 'broad', density: 'balanced', contrast: 'subtle'
      },
      seed: { kind: 'auto' },
      markings: []
    }
  });
const parsed = (value: string) => {
  const result = parseIntentProgram(value);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir);
  return result;
};

const dorsal: IntentProgramSurface = {
  id: 'dorsal', role: 'fin', cardinality: 'single', parent: 'torso',
  anchor: 'top', growth: 'up', lane: 'center',
  shape: {
    axis: 'longitudinal', span: 'medium', chord: 'broad', tip: 'pointed',
    offset: 'posterior', edge: 'convex'
  }
};
const tail: IntentProgramSurface = {
  id: 'tail', role: 'fin', cardinality: 'single', parent: 'torso',
  anchor: 'rear', growth: 'rearward', lane: 'center',
  shape: {
    axis: 'vertical', span: 'long', chord: 'broad', tip: 'forked',
    offset: 'center', edge: 'concave'
  }
};
const shaped = parsed(source([dorsal]));
const planned = planIntentProgram(shaped.ir!);
const plannedDorsal = planned.surfaces[0];
assert.ok(plannedDorsal?.shape);
assert.ok(Object.isFrozen(planned.surfaces));
assert.ok(Object.isFrozen(plannedDorsal));
assert.ok(Object.isFrozen(plannedDorsal.shape));
assert.ok(Object.isFrozen(plannedDorsal.shape.membranes));

const first = parsed(source([tail, dorsal]));
const second = parsed(source([dorsal, tail]));
assert.equal(first.canonical, second.canonical);
const firstPlan = planIntentProgram(first.ir!);
const secondPlan = planIntentProgram(second.ir!);
assert.equal(
  canonicalJsonString(firstPlan.surfaces),
  canonicalJsonString(secondPlan.surfaces)
);
const firstCompiled = compileIntentProgram({
  program: first.ir!, sourceMap: first.sourceMap
});
const secondCompiled = compileIntentProgram({
  program: second.ir!, sourceMap: second.sourceMap
});
if (!firstCompiled.ok || !secondCompiled.ok) {
  throw new Error('permuted surfaces must compile');
}
assert.equal(
  canonicalJsonString(firstCompiled.plan.recipe),
  canonicalJsonString(secondCompiled.plan.recipe)
);

const unshaped: IntentProgramSurface = {
  id: 'fins', role: 'fin', cardinality: 'paired', parent: 'torso',
  anchor: 'sides', growth: 'outward', lane: 'center'
};
const unshapedParsed = parsed(source([unshaped]));
const unshapedCompiled = compileIntentProgram({
  program: unshapedParsed.ir!, sourceMap: unshapedParsed.sourceMap
});
if (!unshapedCompiled.ok) throw new Error('unshaped surface must compile');
const plannedUnshaped = unshapedCompiled.plan.compilation.surfaces[0];
assert.ok(plannedUnshaped);
assert.equal(Object.hasOwn(plannedUnshaped, 'shape'), false);
assert.equal(
  sha256Digest(canonicalJsonString(unshapedCompiled.plan.recipe)),
  'sha256:aaad6462920b6bd0f2688504ac960ab886050e5dfc0fddc84e2cae886a6618a7'
);

const invalidSurface = shaped.ir!.surfaces[0]!;
const invalidProgram: IntentProgramIr = {
  ...shaped.ir!,
  surfaces: [{
    ...invalidSurface,
    shape: { ...invalidSurface.shape!, axis: 'vertical' }
  }]
};
const invalid = compileIntentProgram({
  program: invalidProgram, sourceMap: shaped.sourceMap
});
assert.equal(invalid.ok, false);
if (!invalid.ok) assert.ok(invalid.diagnostics.some((entry) =>
  entry.code === 'intent.surface_shape_axis_parallel'
));

const surface = (id: string): IntentProgramSurface => ({
  id, role: 'fin', cardinality: 'single', parent: 'torso',
  anchor: 'top', growth: 'up', lane: 'center'
});
const capacity = parseIntentProgram(source([
  surface('alpha'), surface('beta'), surface('gamma')
]));
assert.equal(capacity.ir, null);
const overflow = capacity.diagnostics.find((entry) =>
  entry.code === 'intent.attachment_slot_conflict'
);
assert.ok(overflow);
assert.ok(overflow.span.start.line > 1);
