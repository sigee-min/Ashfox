import assert from 'node:assert/strict';

import { compileIntentProgram } from '../../src/compiler/program';
import { planIntentProgram } from '../../src/compiler/program/plan';
import { createIntentProgramLoweringContext } from '../../src/compiler/program/lower/context';
import { materializeIntentProgram } from '../../src/compiler/program/materialize';
import { createProjectDocument } from '../../src/project/create';
import { intentProgramOutputDigest } from '../../src/provenance/program';
import { projectSpatialFrame } from '../../src/project/frame';
import { parseIntentProgram } from '../../src/project/program';
import type {
  IntentProgramIdleAnimation,
  IntentProgramModule,
  IntentProgramSupport,
  IntentProgramSurface,
  IntentProgramSymmetry
} from '../../src/project/program/types';
import { intentProgramSource } from './source';

const appearance = {
  palette: 'metal' as const,
  texture: {
    kind: 'brushed' as const,
    scale: 'medium' as const,
    density: 'sparse' as const,
    contrast: 'subtle' as const
  },
  seed: { kind: 'auto' as const },
  markings: []
};

const source = (
  name: string,
  support: IntentProgramSupport,
  body: readonly IntentProgramModule[],
  options: {
    readonly idle?: IntentProgramIdleAnimation;
    readonly symmetry?: IntentProgramSymmetry;
    readonly surfaces?: readonly IntentProgramSurface[];
  } = {}
): string => intentProgramSource({
  name,
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: options.symmetry ?? 'bilateral',
  support,
  body,
  surfaces: options.surfaces,
  face: { kind: 'none' },
  idle: options.idle ?? { mode: 'still' },
  appearance
});

const parsed = (program: string) => {
  const result = parseIntentProgram(program);
  assert.ok(result.ir, result.diagnostics.map((entry) => entry.message).join('\n'));
  assert.ok(result.hash);
  assert.deepEqual(result.diagnostics, []);
  return result;
};

const materialized = (id: string, program: string) => {
  const result = parsed(program);
  const output = materializeIntentProgram(createProjectDocument({
    id,
    name: id,
    revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source: program, hash: result.hash! });
  if (!output.ok) throw new Error(output.error.message);
  return output.document;
};

const chassis = { id: 'chassis', kind: 'core', cardinality: 'single' } as const;
const frontWheels = {
  id: 'front-wheels', kind: 'wheel', cardinality: 'paired', parent: 'chassis',
  anchor: 'sides', growth: 'down', lane: 'leading'
} as const;
const rearWheels = {
  id: 'rear-wheels', kind: 'wheel', cardinality: 'paired', parent: 'chassis',
  anchor: 'sides', growth: 'down', lane: 'trailing'
} as const;
const fourWheelSource = source(
  'Four wheel chassis',
  { kind: 'wheels', contacts: ['front-wheels', 'rear-wheels'] },
  [chassis, frontWheels, rearWheels]
);
const fourWheelParsed = parsed(fourWheelSource);
const planning = planIntentProgram(fourWheelParsed.ir!);
assert.ok(Object.isFrozen(planning));
assert.ok(Object.isFrozen(planning.attachments));
assert.deepEqual(
  planning.attachments.map((attachment) => attachment.portKey).sort(),
  ['chassis:sides:leading', 'chassis:sides:trailing']
);
assert.deepEqual(planning.support, {
  kind: 'wheels', moduleIds: ['front-wheels', 'rear-wheels']
});

const fourWheelPlan = compileIntentProgram({
  program: fourWheelParsed.ir!,
  sourceMap: fourWheelParsed.sourceMap
});
if (!fourWheelPlan.ok) throw new Error(fourWheelPlan.diagnostics[0]?.message);
const indexedContext = createIntentProgramLoweringContext(
  fourWheelParsed.ir!,
  planning,
  fourWheelPlan.plan.projectIntent
);
const probePart = {
  partId: 'probe', parentPartId: null, materialId: 'mat.base',
  joint: { kind: 'fixed' as const }, attachment: null, kind: 'mass' as const,
  center: [0, 0, 0] as const, radii: [1, 1, 1] as const,
  profile: 'hard' as const
};
indexedContext.addPart(probePart);
assert.equal(indexedContext.part('probe'), probePart);
indexedContext.replacePart('probe', { ...probePart, profile: 'soft' });
const replacedProbe = indexedContext.part('probe');
assert.equal(replacedProbe?.kind === 'mass' ? replacedProbe.profile : null, 'soft');
assert.throws(() => indexedContext.addPart(probePart), /duplicate part/);
const probeGraph = {
  id: 'probe', kind: 'core' as const, sourcePath: 'body.probe',
  parentId: null, cardinality: 'single' as const
};
indexedContext.addGraph(probeGraph);
assert.throws(() => indexedContext.addGraph(probeGraph), /duplicate graph node/);

const frame = projectSpatialFrame(fourWheelPlan.plan.projectIntent);
const forwardCoordinate = (partId: string): number => {
  const part = fourWheelPlan.plan.recipe.parts.find((entry) =>
    entry.partId === partId
  );
  assert.ok(part && part.kind === 'radial');
  return part.center[0] * frame.forward[0] +
    part.center[1] * frame.forward[1] +
    part.center[2] * frame.forward[2];
};
assert.ok(
  forwardCoordinate('wheel.left.front-wheels') >
    forwardCoordinate('wheel.left.rear-wheels')
);
const fourWheel = materialized('four-wheel', fourWheelSource);
assert.equal(fourWheel.authoringProfile?.slots.filter((slot) =>
  slot.support.kind === 'wheel' && slot.support.contact === 'grounded'
).length, 4);

const asymmetricSource = source(
  'Asymmetric paired chassis',
  { kind: 'wheels', contacts: ['front-wheels', 'rear-wheels'] },
  [chassis, frontWheels, rearWheels],
  {
    symmetry: 'asymmetric',
    surfaces: [{
      id: 'antenna', role: 'panel', cardinality: 'single', parent: 'chassis',
      anchor: 'top', growth: 'up', lane: 'center'
    }]
  }
);
const asymmetric = materialized('asymmetric-pair', asymmetricSource);
assert.deepEqual(asymmetric.intent?.symmetry, {
  kind: 'asymmetric', pairPlaneTwice: 0
});
assert.equal(asymmetric.authoringProfile?.slots.filter((slot) =>
  slot.symmetry.kind === 'paired' && slot.support.kind === 'wheel'
).length, 4);

const leg = (id: string, lane: 'leading' | 'center' | 'trailing') => ({
  id, kind: 'limb' as const, cardinality: 'paired' as const, parent: 'torso',
  anchor: 'sides' as const, growth: 'down' as const, lane
});
const hexapodSource = source(
  'Hexapod',
  { kind: 'feet', contacts: ['front-legs', 'middle-legs', 'rear-legs'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    leg('front-legs', 'leading'),
    leg('middle-legs', 'center'),
    leg('rear-legs', 'trailing')
  ]
);
const hexapod = materialized('hexapod', hexapodSource);
const groundedFeet = hexapod.authoringProfile?.slots.filter((slot) =>
  slot.support.kind === 'foot' && slot.support.contact === 'grounded'
) ?? [];
assert.equal(groundedFeet.length, 6);
assert.deepEqual(
  new Set(groundedFeet.map((slot) => slot.slotId.split('.').at(-1))),
  new Set(['front-legs', 'middle-legs', 'rear-legs'])
);

const targetedSource = source(
  'Targeted motion',
  { kind: 'base', contacts: ['torso'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    {
      id: 'head', kind: 'mass', cardinality: 'single', parent: 'torso',
      anchor: 'front', growth: 'forward', lane: 'center'
    }
  ],
  { idle: { mode: 'scan', target: 'head' } }
);
const targeted = materialized('targeted-motion', targetedSource);
assert.equal(
  Object.values(targeted.animations.idle!.channels)[0]!.targetNodeId,
  'bone:mass.head'
);

const duplicateLane = parseIntentProgram(source(
  'Duplicate lane',
  { kind: 'base', contacts: ['torso'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    {
      id: 'alpha', kind: 'mass', cardinality: 'single', parent: 'torso',
      anchor: 'front', growth: 'forward', lane: 'upper'
    },
    {
      id: 'beta', kind: 'mass', cardinality: 'single', parent: 'torso',
      anchor: 'front', growth: 'forward', lane: 'upper'
    }
  ]
));
const conflict = duplicateLane.diagnostics.find((entry) =>
  entry.code === 'intent.attachment_slot_conflict'
);
assert.ok(conflict);
assert.equal(conflict.span.start.line, 13);

const chain = (id: string, parent: string) => ({
  id, kind: 'mass' as const, cardinality: 'single' as const, parent,
  anchor: 'front' as const, growth: 'forward' as const, lane: 'center' as const
});
const oversizedSource = source(
  'Oversized support',
  { kind: 'base', contacts: ['torso'] },
  [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    chain('a', 'torso'), chain('b', 'a'), chain('c', 'b'),
    chain('d', 'c'), chain('e', 'd'), chain('f', 'e')
  ]
);
const oversizedParsed = parsed(oversizedSource);
const oversized = compileIntentProgram({
  program: oversizedParsed.ir!, sourceMap: oversizedParsed.sourceMap
});
assert.equal(oversized.ok, false);
if (!oversized.ok) {
  const issue = oversized.diagnostics.find((entry) =>
    entry.code === 'intent-program.support-envelope-exceeded'
  );
  assert.equal(issue?.span.start.line, 9);
}

const stableSiblings = [
  {
    id: 'a-2', kind: 'mass' as const, cardinality: 'single' as const,
    parent: 'torso', anchor: 'front' as const, growth: 'forward' as const,
    lane: 'center' as const
  },
  {
    id: 'a0', kind: 'mass' as const, cardinality: 'single' as const,
    parent: 'torso', anchor: 'front' as const, growth: 'forward' as const,
    lane: 'upper' as const
  },
  {
    id: 'a-10', kind: 'mass' as const, cardinality: 'single' as const,
    parent: 'torso', anchor: 'front' as const, growth: 'forward' as const,
    lane: 'lower' as const
  }
];
const stableSource = (siblings: readonly IntentProgramModule[]): string => source(
  'Stable code unit order',
  { kind: 'base', contacts: ['torso'] },
  [{ id: 'torso', kind: 'core', cardinality: 'single' }, ...siblings]
);
const stableFirstSource = stableSource(stableSiblings);
const stableSecondSource = stableSource([...stableSiblings].reverse());
const stableFirst = parsed(stableFirstSource);
const stableSecond = parsed(stableSecondSource);
assert.equal(stableFirst.canonical, stableSecond.canonical);
assert.deepEqual(
  stableFirst.ir?.body.map((module) => module.id),
  ['torso', 'a-10', 'a-2', 'a0'],
  'canonical IDs use code-unit order, independent of locale collation'
);
const stableFirstDocument = materialized('stable-order', stableFirstSource);
const stableSecondDocument = materialized('stable-order', stableSecondSource);
assert.equal(
  intentProgramOutputDigest(stableFirstDocument),
  intentProgramOutputDigest(stableSecondDocument)
);
