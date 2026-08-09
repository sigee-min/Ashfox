import assert from 'node:assert/strict';

import { compileIntentProgram } from '../../src/compiler/program';
import { materializeIntentProgram } from '../../src/compiler/program/materialize';
import { createProjectDocument } from '../../src/project/create';
import { projectSpatialFrame } from '../../src/project/frame';
import { parseIntentProgram } from '../../src/project/program';
import type {
  IntentProgramForwardDirection,
  IntentProgramModule,
  IntentProgramSupport
} from '../../src/project/program/types';
import { intentProgramSource } from './source';

const appearance = {
  palette: 'metal' as const,
  texture: {
    kind: 'brushed' as const, scale: 'medium' as const,
    density: 'sparse' as const, contrast: 'subtle' as const
  },
  seed: { kind: 'auto' as const },
  markings: []
};
const source = (
  name: string,
  forward: IntentProgramForwardDirection,
  support: IntentProgramSupport,
  body: readonly IntentProgramModule[]
): string => intentProgramSource({
  name, track: 'essential', domain: 'constructed', forward,
  symmetry: 'bilateral', support, body, face: { kind: 'none' },
  idle: { mode: 'still' }, appearance
});

const parsedSource = (program: string) => {
  const parsed = parseIntentProgram(program);
  assert.deepEqual(parsed.diagnostics, []);
  assert.ok(parsed.ir);
  assert.ok(parsed.hash);
  return parsed;
};
const compiledSource = (program: string) => {
  const parsed = parsedSource(program);
  const compiled = compileIntentProgram({
    program: parsed.ir!, sourceMap: parsed.sourceMap
  });
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(
    (diagnostic) => diagnostic.message
  ).join('\n'));
  return compiled.plan;
};
const materializedSource = (id: string, program: string) => {
  const parsed = parsedSource(program);
  const materialized = materializeIntentProgram(createProjectDocument({
    id, name: id, revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source: program, hash: parsed.hash! });
  if (!materialized.ok) throw new Error(materialized.error.message);
  return materialized.document;
};

const feetProgram = (forward: IntentProgramForwardDirection): string => source(
  'Standing form',
  forward,
  { kind: 'feet', contacts: ['legs'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    {
      id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'torso',
      anchor: 'sides', growth: 'down', lane: 'center'
    }
  ]
);
const wheelProgram = (forward: IntentProgramForwardDirection): string => source(
  'Rolling form',
  forward,
  { kind: 'wheels', contacts: ['wheels'] },
  [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    {
      id: 'wheels', kind: 'wheel', cardinality: 'paired', parent: 'chassis',
      anchor: 'sides', growth: 'down', lane: 'center'
    }
  ]
);
const mass = (id: string, parent: string): IntentProgramModule => ({
  id, kind: 'mass', cardinality: 'single', parent,
  anchor: 'front', growth: 'forward', lane: 'center'
});
const baseProgram = (
  forward: IntentProgramForwardDirection,
  extended: boolean
): string => source(
  'Supported form',
  forward,
  { kind: 'base', contacts: ['chassis'] },
  [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    mass('cargo', 'chassis'),
    ...(extended ? [mass('payload', 'cargo')] : []),
    {
      id: 'mast', kind: 'radial', cardinality: 'single', parent: 'cargo',
      anchor: 'top', growth: 'up', lane: 'center'
    }
  ]
);

for (const forward of ['north', 'south', 'east', 'west'] as const) {
  const feet = materializedSource(`feet-${forward}`, feetProgram(forward));
  assert.equal(feet.authoringProfile?.restPose.mode, 'standing');
  const footSlots = feet.authoringProfile?.slots.filter(
    (slot) => slot.support.kind === 'foot'
  ) ?? [];
  assert.equal(footSlots.length, 2);
  assert.deepEqual(footSlots.map((slot) => slot.support.kind === 'foot'
    ? slot.support.rootPartId
    : null
  ).sort(), [
    'support.foot.legs.left.shin',
    'support.foot.legs.right.shin'
  ]);
  assert.equal((feet.modeling?.parts ?? []).filter((part) =>
    part.partId.startsWith('limb.')
  ).length, 2);

  const wheelPlan = compiledSource(wheelProgram(forward));
  const frame = projectSpatialFrame(wheelPlan.projectIntent);
  const wheels = wheelPlan.recipe.parts.filter((part) =>
    part.partId.startsWith('wheel.')
  );
  assert.equal(wheels.length, 2);
  assert.ok(wheels.every((part) => part.kind === 'radial' &&
    part.joint.kind === 'hinge' && part.joint.axis === frame.lateralAxis
  ));
  const rolling = materializedSource(`wheels-${forward}`, wheelProgram(forward));
  assert.equal(rolling.authoringProfile?.restPose.mode, 'rolling');
  assert.equal(rolling.authoringProfile?.slots.filter((slot) =>
    slot.support.kind === 'wheel'
  ).length, 2);
}

for (const growth of ['down', 'forward', 'rearward', 'up'] as const) {
  const paired = source(
    'Paired limb',
    'north',
    { kind: 'none', contacts: [] },
    [
      { id: 'torso', kind: 'core', cardinality: 'single' },
      {
        id: 'arms', kind: 'limb', cardinality: 'paired', parent: 'torso',
        anchor: 'sides', growth, lane: 'center'
      }
    ]
  );
  assert.equal(
    materializedSource(`paired-limb-${growth}`, paired)
      .authoringProfile?.restPose.mode,
    'none'
  );
}

const compactBase = compiledSource(baseProgram('north', false));
const extendedBase = compiledSource(baseProgram('north', true));
const basePart = (plan: ReturnType<typeof compiledSource>) => {
  const part = plan.recipe.parts.find((candidate) =>
    candidate.partId === 'support.base.chassis'
  );
  assert.ok(part && part.kind === 'mass');
  return part;
};
assert.ok(basePart(extendedBase).radii[2] > basePart(compactBase).radii[2]);
assert.equal(materializedSource(
  'base-extended', baseProgram('north', true)
).authoringProfile?.restPose.mode, 'supported');

const serial = source(
  'Serial body',
  'north',
  { kind: 'base', contacts: ['torso'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    mass('chest', 'torso'),
    mass('head', 'chest'),
    {
      id: 'spine', kind: 'chain', cardinality: 'single', parent: 'torso',
      anchor: 'top', growth: 'up', lane: 'center'
    },
    {
      id: 'crown', kind: 'radial', cardinality: 'single', parent: 'spine',
      anchor: 'top', growth: 'up', lane: 'center'
    }
  ]
);
assert.equal(materializedSource(
  'serial-body', serial
).authoringProfile?.restPose.mode, 'supported');

const invalidCodes = (program: string): readonly string[] =>
  parseIntentProgram(program).diagnostics.map((entry) => entry.code);
const overflow = source(
  'Port overflow',
  'north',
  { kind: 'base', contacts: ['torso'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    mass('alpha', 'torso'),
    mass('beta', 'torso')
  ]
);
assert.ok(invalidCodes(overflow).includes('intent.attachment_slot_conflict'));

const lateral = source(
  'Lateral singleton',
  'north',
  { kind: 'base', contacts: ['torso'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    {
      id: 'horn', kind: 'radial', cardinality: 'single', parent: 'torso',
      anchor: 'left', growth: 'left', lane: 'center'
    }
  ]
);
assert.ok(invalidCodes(lateral).includes(
  'intent.single_sided_body_requires_asymmetric'
));

const invalidWheel = source(
  'Visual wheel',
  'north',
  { kind: 'base', contacts: ['chassis'] },
  [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    {
      id: 'ornaments', kind: 'wheel', cardinality: 'paired', parent: 'chassis',
      anchor: 'sides', growth: 'forward', lane: 'center'
    }
  ]
);
const wheelCodes = invalidCodes(invalidWheel);
assert.ok(wheelCodes.includes('intent.invalid_body_attachment'));
assert.ok(wheelCodes.includes('intent.wheel_requires_wheel_support'));

const ungroundedWheel = source(
  'Ungrounded wheel',
  'north',
  { kind: 'none', contacts: [] },
  [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    {
      id: 'wheels', kind: 'wheel', cardinality: 'paired', parent: 'chassis',
      anchor: 'sides', growth: 'down', lane: 'center'
    }
  ]
);
assert.ok(invalidCodes(ungroundedWheel).includes(
  'intent.wheel_requires_wheel_support'
));
