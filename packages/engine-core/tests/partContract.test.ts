import assert from 'node:assert/strict';

import {
  normalizePartSpec,
  normalizePartSpecs,
  PART_CONTRACT_LIMITS
} from '../src/modeling/partContract';
import { validateCommandInput } from '../src/commands/schema';
import {
  modelPartSpecSchema
} from '../src/commands/definitions/modelPartSchemas';
import { normalizePartRecipe } from '../src/modeling/partRecipe';

const rootMass = {
  kind: 'mass',
  partId: 'body.core',
  materialId: 'material.gold',
  center: [0, 16, 0],
  radii: [12, 16, 8]
};

const normalizedMass = normalizePartSpec(rootMass);
assert.equal(normalizedMass.ok, true);
if (normalizedMass.ok) {
  assert.deepEqual(normalizedMass.value, {
    ...rootMass,
    parentPartId: null,
    joint: { kind: 'fixed' },
    attachment: null,
    profile: 'balanced'
  });
  assert.equal(
    validateCommandInput(
      normalizedMass.value,
      modelPartSpecSchema
    )?.path,
    '$.attachment',
    'the normalized recipe contains internal attachment state'
  );
}
assert.equal(
  validateCommandInput(rootMass, modelPartSpecSchema),
  null,
  'safe omitted fields must also satisfy the published input schema'
);

const childSegment = normalizePartSpec({
  kind: 'segment',
  partId: 'arm.left',
  parentPartId: 'body.core',
  materialId: 'material.gold',
  joint: { kind: 'hinge', axis: 'z' },
  attachment: {
    parentAnchor: [-10, 20, 0],
    partAnchor: [0, 0, 0]
  },
  points: [
    [-10, 20, 0],
    [-18, 12, 0],
    [-22, 4, 0]
  ],
  radii: [
    [4, 4, 4],
    [3, 3, 3],
    [2, 2, 2]
  ]
});
assert.equal(childSegment.ok, true);
assert.equal(
  validateCommandInput(
    {
      kind: 'segment',
      partId: 'arm.left',
      parentPartId: 'body.core',
      materialId: 'material.gold',
      joint: { kind: 'hinge', axis: 'z' },
      attachment: {
        parentAnchor: [-10, 20, 0],
        partAnchor: [0, 0, 0]
      },
      points: [
        [-10, 20, 0],
        [-18, 12, 0]
      ],
      radii: [
        [4, 4, 4],
        [3, 3, 3]
      ]
    },
    modelPartSpecSchema
  )?.path,
  '$.attachment',
  'agent input must not expose internal attachment coordinates'
);

const canonicalPlate = normalizePartSpec({
  kind: 'plate',
  partId: 'wing',
  materialId: 'material.gold',
  plane: 'xy',
  origin: [0, 0, 0],
  outline: [
    [4, 0],
    [4, 3],
    [0, 3],
    [0, 0]
  ],
  thickness: 1
});
assert.equal(canonicalPlate.ok, true);
if (canonicalPlate.ok && canonicalPlate.value.kind === 'plate') {
  assert.deepEqual(canonicalPlate.value.outline, [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3]
  ]);
}

const floatingCoordinate = normalizePartSpec({
  ...rootMass,
  center: [0, 0.5, 0]
});
assert.equal(floatingCoordinate.ok, false);
if (!floatingCoordinate.ok) {
  assert.equal(
    floatingCoordinate.issues.some(
      (issue) => issue.path === '$.center[1]' && issue.code === 'integer'
    ),
    true
  );
}
assert.equal(
  validateCommandInput(
    { ...rootMass, center: [0, 0.5, 0] },
    modelPartSpecSchema
  )?.path,
  '$.center[1]'
);

const unknownKey = normalizePartSpec({
  ...rootMass,
  union: ['tail']
});
assert.equal(unknownKey.ok, false);
if (!unknownKey.ok) {
  assert.equal(
    unknownKey.issues.some(
      (issue) => issue.path === '$.union' && issue.code === 'unknown-key'
    ),
    true
  );
}

const mirrorKey = normalizePartSpec({
  ...rootMass,
  mirror: { axis: 'x', plane: 0 }
});
assert.equal(mirrorKey.ok, false);
if (!mirrorKey.ok) {
  assert.equal(
    mirrorKey.issues.some(
      (issue) => issue.path === '$.mirror' && issue.code === 'unknown-key'
    ),
    true
  );
}

const malformedJoint = normalizePartSpec({
  ...rootMass,
  joint: { kind: 'fixed', axis: 'x' }
});
assert.equal(malformedJoint.ok, false);
if (!malformedJoint.ok) {
  assert.equal(
    malformedJoint.issues.some(
      (issue) =>
        issue.path === '$.joint.axis' && issue.code === 'unknown-key'
    ),
    true
  );
}

const unattachedChild = normalizePartSpec({
  ...rootMass,
  parentPartId: 'body.parent'
});
assert.equal(unattachedChild.ok, true);
if (unattachedChild.ok) {
  assert.equal(unattachedChild.value.attachment, null);
}
const incompleteRecipe = normalizePartRecipe(
  [
    rootMass,
    {
      ...rootMass,
      partId: 'body.child',
      parentPartId: 'body.core'
    }
  ],
  [{ id: 'material.gold', baseColor: '#C58A32' }]
);
assert.equal(incompleteRecipe.ok, false);
if (!incompleteRecipe.ok) {
  assert.ok(
    incompleteRecipe.issues.some(
      (issue) => issue.path.endsWith('.attachment')
    )
  );
}

const rootFeature = normalizePartSpec({
  kind: 'feature',
  partId: 'eye',
  materialId: 'material.eye',
  motif: 'eye',
  face: 'north',
  anchor: [0, 0, 0],
  size: [4, 3]
});
assert.equal(rootFeature.ok, false);
if (!rootFeature.ok) {
  assert.equal(
    rootFeature.issues.some(
      (issue) =>
        issue.path === '$.parentPartId' && issue.code === 'relationship'
    ),
    true
  );
}

const stackedEyeGeometry = normalizePartSpec({
  ...rootMass,
  partId: 'face.eye.pupil'
});
assert.equal(stackedEyeGeometry.ok, false);
if (!stackedEyeGeometry.ok) {
  assert.equal(
    stackedEyeGeometry.issues.some(
      (issue) =>
        issue.path === '$.partId' &&
        issue.code === 'relationship' &&
        issue.message.includes('motif "eye"')
    ),
    true,
    'eye-like geometry ids must be rejected in favor of semantic features'
  );
}

const nonConvexPlate = normalizePartSpec({
  kind: 'plate',
  partId: 'broken.plate',
  materialId: 'material.gold',
  plane: 'xz',
  origin: [0, 0, 0],
  outline: [
    [0, 0],
    [4, 0],
    [1, 1],
    [0, 4]
  ],
  thickness: 1
});
assert.equal(nonConvexPlate.ok, false);
if (!nonConvexPlate.ok) {
  assert.equal(
    nonConvexPlate.issues.some((issue) => issue.code === 'geometry'),
    true
  );
}

const nonTrapezoidPlate = normalizePartSpec({
  kind: 'plate',
  partId: 'unsupported.quad',
  materialId: 'material.gold',
  plane: 'xy',
  origin: [0, 0, 0],
  outline: [
    [0, 0],
    [4, 0],
    [3, 3],
    [0, 2]
  ],
  thickness: 1
});
assert.equal(nonTrapezoidPlate.ok, false);
if (!nonTrapezoidPlate.ok) {
  assert.equal(
    nonTrapezoidPlate.issues.some(
      (issue) =>
        issue.code === 'geometry' && issue.message.includes('trapezoid')
    ),
    true
  );
}

const namespacedId = normalizePartSpec({
  ...rootMass,
  partId: 'body/core'
});
assert.equal(namespacedId.ok, false);
if (!namespacedId.ok) {
  assert.equal(
    namespacedId.issues.some(
      (issue) => issue.path === '$.partId' && issue.code === 'id'
    ),
    true
  );
}
assert.equal(
  validateCommandInput(
    { ...rootMass, partId: 'body/core' },
    modelPartSpecSchema
  )?.path,
  '$.partId'
);

const duplicateBatch = normalizePartSpecs([rootMass, rootMass]);
assert.equal(duplicateBatch.ok, false);
if (!duplicateBatch.ok) {
  assert.equal(
    duplicateBatch.issues.some((issue) => issue.code === 'duplicate'),
    true
  );
}

const cyclicBatch = normalizePartSpecs([
  {
    ...rootMass,
    partId: 'cycle.a',
    parentPartId: 'cycle.b',
    attachment: {
      parentAnchor: [0, 0, 0],
      partAnchor: [0, 0, 0]
    }
  },
  {
    ...rootMass,
    partId: 'cycle.b',
    parentPartId: 'cycle.a',
    attachment: {
      parentAnchor: [0, 0, 0],
      partAnchor: [0, 0, 0]
    }
  }
]);
assert.equal(cyclicBatch.ok, false);
if (!cyclicBatch.ok) {
  assert.equal(
    cyclicBatch.issues.some(
      (issue) =>
        issue.code === 'relationship' && issue.message.includes('cycle')
    ),
    true
  );
}

const oversizedMass = normalizePartSpec({
  ...rootMass,
  radii: [
    PART_CONTRACT_LIMITS.maxExtent,
    PART_CONTRACT_LIMITS.maxExtent,
    PART_CONTRACT_LIMITS.maxExtent
  ]
});
assert.equal(oversizedMass.ok, false);
if (!oversizedMass.ok) {
  assert.equal(
    oversizedMass.issues.some(
      (issue) => issue.code === 'budget' || issue.code === 'range'
    ),
    true
  );
}

const anisotropicSegment = normalizePartSpec({
  kind: 'segment',
  partId: 'budget.segment',
  materialId: 'material.gold',
  points: [
    [0, 0, 0],
    [100, 0, 0]
  ],
  radii: [
    [1, 32, 1],
    [1, 32, 1]
  ]
});
assert.equal(
  anisotropicSegment.ok,
  true,
  'segment budget must use per-axis bounds instead of one global radius'
);

const thinRadialRing = normalizePartSpec({
  kind: 'radial',
  partId: 'budget.ring',
  materialId: 'material.gold',
  axis: 'y',
  center: [0, 0, 0],
  outerRadius: PART_CONTRACT_LIMITS.maxExtent,
  innerRadius: PART_CONTRACT_LIMITS.maxExtent - 1,
  depth: 3
});
assert.equal(
  thinRadialRing.ok,
  true,
  'radial budget must count the bounded annulus instead of its square box'
);

const oversizedSolidRadial = normalizePartSpec({
  kind: 'radial',
  partId: 'budget.solid',
  materialId: 'material.gold',
  axis: 'y',
  center: [0, 0, 0],
  outerRadius: PART_CONTRACT_LIMITS.maxExtent,
  innerRadius: 0,
  depth: 3
});
assert.equal(oversizedSolidRadial.ok, false);
if (!oversizedSolidRadial.ok) {
  assert.equal(
    oversizedSolidRadial.issues.some(
      (issue) => issue.code === 'budget'
    ),
    true,
    'exact radial counting must still reject a real occupancy overflow'
  );
}
