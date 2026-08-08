import assert from 'node:assert/strict';

import {
  createAuthoringProfile,
  createProjectFromInput,
  evaluateSymmetryQuality,
  executeSystemCommandBatch,
  getAuthoringRecipe,
  projectSpatialFrame,
  readCompiledParts,
  reflectProjectCell,
  reflectProjectPoint,
  type AuthoringSelectionInput,
  type CommandBatch,
  type PartAuthoringSpec,
  type ProjectDocument,
  type ProjectForwardDirection,
  type Vec3
} from '../src';

let batchSequence = 0;

const execute = (
  document: ProjectDocument,
  label: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  batchSequence += 1;
  const result = executeSystemCommandBatch(document, {
    batchId: `symmetry-${label}-${batchSequence}`,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations
  });
  if (!result.ok) {
    throw new Error(
      `${label}: ${result.error.code}: ${result.error.message} at ` +
        `${result.error.path ?? '-'}; findings=` +
        JSON.stringify(result.findings ?? [])
    );
  }
  return result.document;
};

const recipe = getAuthoringRecipe('recipe.composable-form');
if (!recipe) throw new Error('Expected composable authoring recipe.');

const baseSelection = (
  slots: AuthoringSelectionInput['slots']
): AuthoringSelectionInput => ({
  archetype: recipe.archetype,
  track: 'essential',
  faceMode: 'none',
  face: null,
  specialists: [],
  claims: recipe.claimSuggestions,
  slots,
  coverage: [],
  bindings: []
});

const symmetrySlots: AuthoringSelectionInput['slots'] = [
  {
    slotId: 'core',
    structuralRole: 'core',
    qualityStage: 'silhouette',
    partIds: ['core'],
    parentSlotIds: [],
    spatialRelations: [],
    facing: null,
    symmetry: { kind: 'centered' },
    support: { kind: 'none' }
  },
  {
    slotId: 'axis.center',
    structuralRole: 'axis',
    qualityStage: 'structure',
    partIds: ['center.low', 'center.high'],
    parentSlotIds: ['core'],
    spatialRelations: ['above'],
    facing: null,
    symmetry: { kind: 'centered' },
    support: { kind: 'none' }
  },
  {
    slotId: 'limb.left',
    structuralRole: 'accent',
    qualityStage: 'silhouette',
    partIds: ['limb.left'],
    parentSlotIds: ['core'],
    spatialRelations: ['left'],
    facing: null,
    symmetry: { kind: 'paired', pairId: 'pair.limb' },
    support: { kind: 'none' }
  },
  {
    slotId: 'limb.right',
    structuralRole: 'accent',
    qualityStage: 'silhouette',
    partIds: ['limb.right'],
    parentSlotIds: ['core'],
    spatialRelations: ['right'],
    facing: null,
    symmetry: { kind: 'paired', pairId: 'pair.limb' },
    support: { kind: 'none' }
  }
];

const setCoordinate = (
  value: Vec3,
  axis: 'x' | 'z',
  coordinate: number
): Vec3 => {
  const result: [number, number, number] = [...value];
  result[axis === 'x' ? 0 : 2] = coordinate;
  return result;
};

const cellKey = (cell: Vec3): string => cell.join(',');
const parseCellKey = (key: string): Vec3 =>
  key.split(',').map(Number) as [number, number, number];

interface SymmetryCase {
  direction: ProjectForwardDirection;
  planeTwice: 0 | 1;
  expectedCoreWidth: 4 | 3;
}

const cases: readonly SymmetryCase[] = [
  { direction: 'north', planeTwice: 0, expectedCoreWidth: 4 },
  { direction: 'south', planeTwice: 1, expectedCoreWidth: 3 },
  { direction: 'east', planeTwice: 0, expectedCoreWidth: 4 },
  { direction: 'west', planeTwice: 1, expectedCoreWidth: 3 }
];

const createIntended = (
  testCase: SymmetryCase,
  suffix: string
): ProjectDocument => {
  const base = createProjectFromInput({
    id: `symmetry-quality-${testCase.direction}-${suffix}`,
    name: `Symmetry quality ${testCase.direction}`,
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: `symmetry_quality_${testCase.direction}_${suffix}`,
    createdAt: '2026-08-08T00:00:00.000Z'
  }, `symmetry-base-${testCase.direction}-${suffix}`);
  return execute(base, `${suffix}-intent`, [{
    name: 'project.intent.set',
    payload: {
      subject: 'Bilateral regression fixture',
      forward: testCase.direction,
      grounding: 'free',
      symmetry: {
        kind: 'bilateral',
        planeTwice: testCase.planeTwice
      },
      features: [],
      references: []
    }
  }]);
};

const fixtureParts = (
  document: ProjectDocument
): readonly PartAuthoringSpec[] => {
  if (!document.intent || document.intent.symmetry.kind !== 'bilateral') {
    throw new Error('Expected bilateral fixture intent.');
  }
  const frame = projectSpatialFrame(document.intent);
  const axis = frame.lateralAxis;
  const planeTwice = document.intent.symmetry.planeTwice;
  const lowPairCoordinate = planeTwice === 0 ? -3 : -2;
  const highPairCoordinate = planeTwice === 0 ? 3 : 3;
  const leftCoordinate = frame.lateralSign === 1
    ? lowPairCoordinate
    : highPairCoordinate;
  const rightCoordinate = frame.lateralSign === 1
    ? highPairCoordinate
    : lowPairCoordinate;
  const lowCenterCoordinate = -1;
  const highCenterCoordinate = planeTwice - lowCenterCoordinate;
  const lateralRadii = (radius: number): Vec3 =>
    setCoordinate([1, 1, 1], axis, radius);
  const centeredChild = (
    partId: string,
    coordinate: number
  ): PartAuthoringSpec => ({
    kind: 'mass',
    partId,
    parentPartId: 'core',
    materialId: 'body',
    joint: { kind: 'hinge', axis: 'y' },
    center: setCoordinate([0, 4, 0], axis, coordinate),
    radii: lateralRadii(1),
    profile: 'block'
  });
  const pairedChild = (
    partId: 'limb.left' | 'limb.right',
    coordinate: number
  ): PartAuthoringSpec => ({
    kind: 'mass',
    partId,
    parentPartId: 'core',
    materialId: 'body',
    joint: { kind: 'hinge', axis: 'y' },
    center: setCoordinate([0, 0, 0], axis, coordinate),
    radii: lateralRadii(1),
    profile: 'block'
  });
  const core: PartAuthoringSpec = planeTwice === 0
    ? {
        kind: 'mass',
        partId: 'core',
        parentPartId: null,
        materialId: 'body',
        center: [0, 0, 0],
        radii: axis === 'x' ? [2, 3, 3] : [3, 3, 2],
        profile: 'block'
      }
    : {
        kind: 'radial',
        partId: 'core',
        parentPartId: null,
        materialId: 'body',
        axis,
        center: [0, 0, 0],
        outerRadius: 3,
        innerRadius: 0,
        depth: 3
      };
  return [
    core,
    centeredChild('center.low', lowCenterCoordinate),
    centeredChild('center.high', highCenterCoordinate),
    pairedChild('limb.left', leftCoordinate),
    pairedChild('limb.right', rightCoordinate)
  ];
};

const materialize = (testCase: SymmetryCase): ProjectDocument => {
  const intended = createIntended(testCase, 'materialized');
  const configured = execute(intended, 'configure', [{
    name: 'project.authoring.configure',
    payload: baseSelection(symmetrySlots)
  }]);
  return execute(configured, 'materialize', [{
    name: 'model.parts.upsert',
    payload: {
      parts: fixtureParts(configured),
      materials: [{ id: 'body', baseColor: '#445566' }]
    }
  }]);
};

for (const testCase of cases) {
  const document = materialize(testCase);
  if (!document.intent || !document.authoringProfile) {
    throw new Error('Expected materialized authoring fixture.');
  }
  const frame = projectSpatialFrame(document.intent);
  const compiled = readCompiledParts(document);
  assert.equal(compiled.ok, true, `${testCase.direction}: compiled model`);
  if (!compiled.ok) throw new Error(compiled.issues[0]?.message);

  const coreCells = compiled.parts.get('core')?.occupancy.cells;
  const leftCells = compiled.parts.get('limb.left')?.occupancy.cells;
  const rightCells = compiled.parts.get('limb.right')?.occupancy.cells;
  assert.ok(coreCells && leftCells && rightCells);
  const axisIndex = frame.lateralAxis === 'x' ? 0 : 2;
  const coreCoordinates = [...coreCells].map(
    (key) => parseCellKey(key)[axisIndex]
  );
  assert.equal(
    Math.max(...coreCoordinates) - Math.min(...coreCoordinates) + 1,
    testCase.expectedCoreWidth,
    `${testCase.direction}: integer plane has an even core; half plane has an odd core`
  );

  const reflectedCore = new Set([...coreCells].map((key) =>
    cellKey(reflectProjectCell(parseCellKey(key), frame))
  ));
  assert.deepEqual(
    [...reflectedCore].sort(),
    [...coreCells].sort(),
    `${testCase.direction}: centered compiled occupancy is self-reflecting`
  );
  const reflectedLeft = new Set([...leftCells].map((key) =>
    cellKey(reflectProjectCell(parseCellKey(key), frame))
  ));
  assert.deepEqual(
    [...reflectedLeft].sort(),
    [...rightCells].sort(),
    `${testCase.direction}: pair is an exact post-compiled occupancy reflection`
  );

  const quality = evaluateSymmetryQuality(
    document,
    document.authoringProfile
  );
  assert.equal(quality.ready, true, `${testCase.direction}: quality ready`);
  assert.equal(quality.violations.length, 0);
  assert.ok(quality.statuses.every((status) =>
    status.complete &&
    status.geometryExact &&
    status.featureExact &&
    status.rigExact &&
    status.lateralOwnershipExact
  ));
  const centeredRig = quality.statuses.find(
    (status) => status.id === 'centered:axis.center'
  );
  assert.equal(
    centeredRig?.rigExact,
    true,
    `${testCase.direction}: centered child pivot/joint set self-reflects`
  );
  const left = compiled.parts.get('limb.left');
  const right = compiled.parts.get('limb.right');
  assert.ok(left && right);
  assert.deepEqual(left.joint, { kind: 'hinge', axis: 'y' });
  assert.deepEqual(right.joint, left.joint);
  assert.deepEqual(
    reflectProjectPoint(left.bone.transform.pivot, frame),
    right.bone.transform.pivot,
    `${testCase.direction}: compiled pair pivots reflect exactly`
  );
}

// Parent correspondence follows the reflected slot graph: literal left/right
// parent IDs differ, but the parent pair ID and semantic side correspond.
const nestedIntent = createIntended(cases[0], 'nested-profile');
const nestedSlots: AuthoringSelectionInput['slots'] = [
  symmetrySlots[0],
  symmetrySlots[1],
  {
    ...symmetrySlots[2],
    slotId: 'upper.left',
    partIds: ['upper.left'],
    symmetry: { kind: 'paired', pairId: 'pair.upper' }
  },
  {
    ...symmetrySlots[3],
    slotId: 'upper.right',
    partIds: ['upper.right'],
    symmetry: { kind: 'paired', pairId: 'pair.upper' }
  },
  {
    ...symmetrySlots[2],
    slotId: 'lower.left',
    partIds: ['lower.left'],
    parentSlotIds: ['upper.left'],
    symmetry: { kind: 'paired', pairId: 'pair.lower' }
  },
  {
    ...symmetrySlots[3],
    slotId: 'lower.right',
    partIds: ['lower.right'],
    parentSlotIds: ['upper.right'],
    symmetry: { kind: 'paired', pairId: 'pair.lower' }
  }
];
const nestedProfile = createAuthoringProfile(
  nestedIntent,
  baseSelection(nestedSlots)
);
assert.equal(
  nestedProfile.ok,
  true,
  'nested reflected parent pairs are semantically isomorphic'
);
const mismatchedNestedProfile = createAuthoringProfile(
  nestedIntent,
  baseSelection(nestedSlots.map((slot) =>
    slot.slotId === 'lower.right'
      ? { ...slot, parentSlotIds: ['upper.left'] }
      : slot
  ))
);
assert.equal(mismatchedNestedProfile.ok, false);
if (!mismatchedNestedProfile.ok) {
  assert.ok(mismatchedNestedProfile.issues.some((issue) =>
    issue.message.includes('isomorphic support slots')
  ));
}
const asymmetricParentProfile = createAuthoringProfile(
  nestedIntent,
  baseSelection([
    ...nestedSlots,
    {
      ...symmetrySlots[2],
      slotId: 'anchor.asymmetric',
      partIds: ['anchor.asymmetric'],
      symmetry: { kind: 'asymmetric' }
    }
  ].map((slot) =>
    slot.slotId === 'lower.left'
      ? { ...slot, parentSlotIds: ['anchor.asymmetric'] }
      : slot
  ))
);
assert.equal(
  asymmetricParentProfile.ok,
  false,
  'a paired child cannot claim an asymmetric parent without a counterpart'
);
if (!asymmetricParentProfile.ok) {
  assert.ok(asymmetricParentProfile.issues.some((issue) =>
    issue.message.includes('isomorphic support slots')
  ));
}

// The command pipeline returns no mutated document on failure; the caller's
// immutable input remains byte-for-byte unchanged after a one-sided mutation.
const atomicBase = materialize(cases[0]);
const atomicSnapshot = JSON.stringify(atomicBase);
const rejectOneSided = (
  label: string,
  operations: CommandBatch['operations']
): void => {
  batchSequence += 1;
  const result = executeSystemCommandBatch(atomicBase, {
    batchId: `symmetry-atomic-${label}-${batchSequence}`,
    baseProjectId: atomicBase.id,
    baseRevision: atomicBase.revision,
    operations
  });
  assert.equal(result.ok, false, `${label}: one-sided mutation is rejected`);
  if (!result.ok) {
    assert.equal(result.error.code, 'invalid_state');
    assert.ok(result.findings?.some((finding) =>
      finding.code === 'document.invalid_authoring_invariant' &&
      finding.path.includes('pair.limb')
    ));
  }
  assert.equal(JSON.stringify(atomicBase), atomicSnapshot);
};

rejectOneSided('transform', [{
  name: 'model.parts.transform',
  payload: { rootPartId: 'limb.left', by: [0, 1, 0] }
}]);
rejectOneSided('delete', [{
  name: 'model.parts.delete',
  payload: { partIds: ['limb.left'] }
}]);
rejectOneSided('rig', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'mass',
      partId: 'limb.right',
      joint: { kind: 'hinge', axis: 'x' }
    }]
  }
}]);
