import assert from 'node:assert/strict';

import { compileIntentProgram } from '../src/compiler/intentProgram';
import { materializeIntentProgram } from '../src/compiler/intentProgram/materialize';
import { createProjectDocument } from '../src/project/createProjectDocument';
import { parseIntentProgram } from '../src/project/intentProgram';
import { projectSpatialFrame } from '../src/project/projectSpatialFrame';

const source = (
  asset: string,
  forward: 'north' | 'south' | 'east' | 'west',
  rest: string,
  body: readonly string[]
): string => [
  `asset "${asset}"`,
  'track essential',
  'domain constructed',
  `frame front ${forward}`,
  'symmetry bilateral',
  rest,
  ...body,
  'face none',
  'motion idle still',
  'style palette metal'
].join('\n');

const parsedSource = (program: string) => {
  const parsed = parseIntentProgram(program);
  assert.deepEqual(
    parsed.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
    [],
    'fixture must satisfy the Intent Program grammar'
  );
  assert.ok(parsed.ir);
  assert.ok(parsed.hash);
  return parsed;
};

const compiledSource = (program: string) => {
  const parsed = parsedSource(program);
  const compiled = compileIntentProgram({
    program: parsed.ir!,
    sourceMap: parsed.sourceMap
  });
  assert.equal(compiled.ok, true, 'fixture must lower');
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(
    (diagnostic) => diagnostic.message
  ).join('\n'));
  return compiled.plan;
};

const materializedSource = (id: string, program: string) => {
  const parsed = parsedSource(program);
  const materialized = materializeIntentProgram(
    createProjectDocument({
      id,
      name: id,
      revision: 'revision-1',
      createdAt: '2026-08-09T00:00:00.000Z'
    }),
    { source: program, hash: parsed.hash! }
  );
  assert.equal(materialized.ok, true, 'fixture must materialize as ready');
  if (!materialized.ok) throw new Error(materialized.error.message);
  return materialized.document;
};

const feetProgram = (forward: 'north' | 'south' | 'east' | 'west'): string =>
  source('Standing form', forward, 'rest neutral feet on legs', [
    'body core torso',
    'body limb legs pair from torso extends down'
  ]);

const wheelProgram = (forward: 'north' | 'south' | 'east' | 'west'): string =>
  source('Rolling form', forward, 'rest neutral wheels on wheels', [
    'body core chassis',
    'body wheel wheels pair from chassis extends down'
  ]);

const baseProgram = (
  forward: 'north' | 'south' | 'east' | 'west',
  extended: boolean
): string => source('Supported form', forward, 'rest neutral base on chassis', [
  'body core chassis',
  'body mass cargo from chassis extends forward',
  ...(extended ? ['body mass payload from cargo extends forward'] : []),
  'body radial mast from cargo extends up'
]);

for (const forward of ['north', 'south', 'east', 'west'] as const) {
  const feet = materializedSource(`feet-${forward}`, feetProgram(forward));
  assert.equal(feet.authoringProfile?.restPose.mode, 'standing');
  const footSlots = feet.authoringProfile?.slots.filter(
    (slot) => slot.support.kind === 'foot'
  ) ?? [];
  assert.equal(footSlots.length, 2, 'feet use exactly the declared limb pair');
  assert.deepEqual(
    footSlots.map((slot) => slot.support.kind === 'foot'
      ? slot.support.rootPartId
      : null
    ).sort(),
    [
      'support.foot.legs.left.shin',
      'support.foot.legs.right.shin'
    ],
    'the foot root is the explicit lower segment attached to the declared limb'
  );
  assert.equal(
    (feet.modeling?.parts ?? []).filter((part) =>
      part.partId.startsWith('limb.')
    ).length,
    2,
    'rest lowering must not invent a fixed four-leg topology'
  );

  const wheelPlan = compiledSource(wheelProgram(forward));
  const frame = projectSpatialFrame(wheelPlan.projectIntent);
  const wheels = wheelPlan.recipe.parts.filter((part) =>
    part.partId.startsWith('wheel.')
  );
  assert.equal(wheels.length, 2);
  assert.ok(wheels.every((part) =>
    part.kind === 'radial' &&
    part.joint.kind === 'hinge' &&
    part.joint.axis === frame.lateralAxis
  ), 'wheel modules lower to real lateral-axis hinged radial primitives');
  const rolling = materializedSource(`wheels-${forward}`, wheelProgram(forward));
  assert.equal(rolling.authoringProfile?.restPose.mode, 'rolling');
  assert.equal(
    rolling.authoringProfile?.slots.filter(
      (slot) => slot.support.kind === 'wheel'
    ).length,
    2,
    'rolling support is owned by the declared wheel module itself'
  );
}

for (const extension of ['down', 'forward', 'rearward', 'up'] as const) {
  const pairedLimb = source('Paired limb', 'north', 'rest airborne', [
    'body core torso',
    `body limb arms pair from torso extends ${extension}`
  ]);
  assert.equal(
    materializedSource(`paired-limb-${extension}`, pairedLimb)
      .authoringProfile?.restPose.mode,
    'airborne',
    `paired limb ${extension} remains an exact bilateral non-support topology`
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
const compactFootprint = basePart(compactBase).radii;
const extendedFootprint = basePart(extendedBase).radii;
assert.ok(
  extendedFootprint[2] > compactFootprint[2],
  'base footprint must grow from the compiled forward body envelope, not a fixed cube'
);
assert.equal(
  materializedSource('base-compact', baseProgram('north', false))
    .authoringProfile?.restPose.mode,
  'supported'
);
assert.equal(
  materializedSource('base-extended', baseProgram('north', true))
    .authoringProfile?.restPose.mode,
  'supported'
);

const serialProgram = source('Serial body', 'north', 'rest neutral base on torso', [
  'body core torso',
  'body mass chest from torso extends forward',
  'body mass head from chest extends forward',
  'body chain spine from torso extends up',
  'body radial crown from spine extends up'
]);
assert.equal(
  materializedSource('serial-body', serialProgram).authoringProfile?.restPose.mode,
  'supported',
  'serial hosts remain materializable without sibling coordinate collisions'
);

const overflowProgram = source('Port overflow', 'north', 'rest neutral base on torso', [
  'body core torso',
  'body mass alpha from torso extends forward',
  'body mass beta from torso extends forward'
]);
const overflowParsed = parsedSource(overflowProgram);
const overflow = compileIntentProgram({
  program: overflowParsed.ir!,
  sourceMap: overflowParsed.sourceMap
});
assert.equal(overflow.ok, false);
if (!overflow.ok) {
  assert.ok(overflow.diagnostics.some((diagnostic) =>
    diagnostic.code === 'intent-program.body-port-capacity-exceeded'
  ), 'unrepresentable sibling topology is rejected before geometry lowering');
}

const lateralProgram = source('Lateral singleton', 'north',
  'rest neutral base on torso', [
    'body core torso',
    'body radial horn from torso extends left'
  ]
);
const lateralParsed = parsedSource(lateralProgram);
const lateral = compileIntentProgram({
  program: lateralParsed.ir!,
  sourceMap: lateralParsed.sourceMap
});
assert.equal(lateral.ok, false);
if (!lateral.ok) {
  assert.ok(lateral.diagnostics.some((diagnostic) =>
    diagnostic.code === 'intent-program.unpaired-lateral-module'
  ), 'a bilateral singleton cannot claim one lateral body port');
}

const visualWheelProgram = source('Visual wheel', 'north',
  'rest neutral base on chassis', [
    'body core chassis',
    'body wheel ornaments pair from chassis extends forward'
  ]
);
const visualWheelParsed = parsedSource(visualWheelProgram);
const visualWheel = compileIntentProgram({
  program: visualWheelParsed.ir!,
  sourceMap: visualWheelParsed.sourceMap
});
assert.equal(visualWheel.ok, false);
if (!visualWheel.ok) {
  assert.ok(visualWheel.diagnostics.some((diagnostic) =>
    diagnostic.code === 'intent-program.unsupported-module-extension'
  ), 'a wheel cannot claim an unimplemented visual direction; use radial instead');
}

const ungroundedWheelProgram = source('Ungrounded wheel', 'north',
  'rest airborne', [
    'body core chassis',
    'body wheel wheels pair from chassis extends down'
  ]
);
const ungroundedWheelParsed = parsedSource(ungroundedWheelProgram);
const ungroundedWheel = compileIntentProgram({
  program: ungroundedWheelParsed.ir!,
  sourceMap: ungroundedWheelParsed.sourceMap
});
assert.equal(ungroundedWheel.ok, false);
if (!ungroundedWheel.ok) {
  assert.ok(ungroundedWheel.diagnostics.some((diagnostic) =>
    diagnostic.code === 'intent-program.wheel-requires-rolling-rest'
  ), 'wheel topology cannot reach materialization without explicit rolling rest');
}
