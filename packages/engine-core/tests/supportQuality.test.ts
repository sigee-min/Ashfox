import assert from 'node:assert/strict';

import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  AUTHORING_ROUTING_CONTRACT_VERSION,
  createProjectFromInput,
  executeSystemCommandBatch,
  executeAgentCommandBatch,
  evaluateSymmetryQuality,
  type AuthoringProfile,
  type AuthoringSelectionInput,
  type CommandBatch,
  type ProjectDocument,
  type ProjectForwardDirection
} from '../src';
import { evaluateSupportQuality } from '../src/authoring/supportQuality';
import type { AuthoringSupport } from '../src/authoring/authoringTypes';

type Point = readonly [number, number, number];

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  const result = executeSystemCommandBatch(document, {
    batchId,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations
  });
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const frameVectors = (
  direction: ProjectForwardDirection
): { forward: Point; left: Point } => {
  switch (direction) {
    case 'north':
      return { forward: [0, 0, -1], left: [-1, 0, 0] };
    case 'south':
      return { forward: [0, 0, 1], left: [1, 0, 0] };
    case 'east':
      return { forward: [1, 0, 0], left: [0, 0, -1] };
    case 'west':
      return { forward: [-1, 0, 0], left: [0, 0, 1] };
  }
};

const localPoint = (
  direction: ProjectForwardDirection,
  lateral: number,
  up: number,
  forward: number
): Point => {
  const frame = frameVectors(direction);
  return [
    frame.left[0] * lateral + frame.forward[0] * forward,
    up,
    frame.left[2] * lateral + frame.forward[2] * forward
  ];
};

const horizontalRectangle = (
  direction: ProjectForwardDirection,
  up: number
): { origin: Point; size: readonly [number, number] } => {
  const corners = [
    localPoint(direction, -1, up, -1),
    localPoint(direction, -1, up, 1),
    localPoint(direction, 1, up, -1),
    localPoint(direction, 1, up, 1)
  ];
  const xs = corners.map((point) => point[0]);
  const zs = corners.map((point) => point[2]);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumZ = Math.min(...zs);
  const maximumZ = Math.max(...zs);
  return {
    origin: [minimumX, up, minimumZ],
    size: [maximumX - minimumX, maximumZ - minimumZ]
  };
};

interface FootProjectOptions {
  direction: ProjectForwardDirection;
  reversedToe?: boolean;
  reversedClaw?: boolean;
  verticalOffset?: number;
  soleOriginOffset?: number;
  soleThickness?: number;
}

const footProject = ({
  direction,
  reversedToe = false,
  reversedClaw = false,
  verticalOffset = 0,
  soleOriginOffset = 0,
  soleThickness = 1
}: FootProjectOptions): ProjectDocument => {
  const id = [
    'support',
    direction,
    reversedToe ? 'reversed-toe' : 'toe',
    reversedClaw ? 'reversed-claw' : 'claw',
    verticalOffset,
    soleOriginOffset,
    soleThickness
  ].join('-');
  const empty = createProjectFromInput({
    id,
    name: id,
    target: 'glb',
    namespace: 'ashfox',
    modelPath: id,
    createdAt: '2026-08-08T00:00:00.000Z'
  }, 'support-0001');
  const sole = horizontalRectangle(
    direction,
    verticalOffset + soleOriginOffset
  );
  const toeForward = reversedToe ? -2 : 2;
  const clawForward = reversedClaw ? 0 : reversedToe ? -4 : 4;
  const clawLateral = reversedClaw ? 2 : 0;
  const modeled = execute(empty, `${id}-model`, [{
    name: 'model.parts.upsert',
    payload: {
      parts: [
        {
          kind: 'mass',
          partId: 'body',
          parentPartId: null,
          materialId: 'fur',
          center: localPoint(direction, 0, 5 + verticalOffset, 0),
          radii: [2, 2, 2]
        },
        {
          kind: 'mass',
          partId: 'foot.root',
          parentPartId: 'body',
          materialId: 'fur',
          center: localPoint(direction, 0, 2 + verticalOffset, 0),
          radii: [1, 1, 1]
        },
        {
          kind: 'plate',
          partId: 'foot.sole',
          parentPartId: 'foot.root',
          materialId: 'sole',
          plane: 'xz',
          origin: sole.origin,
          size: sole.size,
          thickness: soleThickness
        },
        {
          kind: 'mass',
          partId: 'foot.toe',
          parentPartId: 'foot.root',
          materialId: 'fur',
          center: localPoint(
            direction,
            0,
            1 + verticalOffset,
            toeForward
          ),
          radii: reversedClaw ? [2, 1, 1] : [1, 1, 1]
        },
        {
          kind: 'mass',
          partId: 'foot.claw',
          parentPartId: 'foot.toe',
          materialId: 'claw',
          center: localPoint(
            direction,
            clawLateral,
            1 + verticalOffset,
            clawForward
          ),
          radii: [1, 1, 1]
        }
      ],
      materials: [
        { id: 'fur', baseColor: '#A05030' },
        { id: 'sole', baseColor: '#38231F' },
        { id: 'claw', baseColor: '#E8D9B5' }
      ]
    }
  }]);
  return {
    ...modeled,
    intent: {
      subject: 'Audited foot',
      forward: direction,
      grounding: 'grounded',
      symmetry: { kind: 'asymmetric' },
      features: []
    }
  };
};

const footSupport = (
  overrides: Partial<Extract<AuthoringSupport, { kind: 'foot' }>> = {}
): Extract<AuthoringSupport, { kind: 'foot' }> => ({
  kind: 'foot',
  contact: 'grounded',
  rootPartId: 'foot.root',
  solePartIds: ['foot.sole'],
  digits: [{
    digitId: 'center',
    toePartIds: ['foot.toe'],
    clawPartIds: ['foot.claw']
  }],
  ...overrides
});

const profileFor = (
  support: AuthoringSupport,
  partIds: readonly string[] = [
    'foot.root',
    'foot.sole',
    'foot.toe',
    'foot.claw'
  ]
): AuthoringProfile => ({
  schemaVersion: AUTHORING_PROFILE_SCHEMA_VERSION,
  archetype: {
    id: 'archetype.composable-form',
    version: AUTHORING_PROFILE_SCHEMA_VERSION
  },
  track: 'hero',
  faceMode: 'none',
  face: null,
  specialists: [],
  claims: [],
  routing: {
    contractVersion: AUTHORING_ROUTING_CONTRACT_VERSION,
    animationSupported: true,
    canonicalInput: 'support-quality-test',
    referenceIds: []
  },
  slots: [{
    slotId: 'support.primary',
    structuralRole: 'articulated',
    qualityStage: 'structure',
    partIds,
    parentSlotIds: [],
    spatialRelations: [],
    facing: 'forward',
    symmetry: { kind: 'asymmetric' },
    support
  }],
  coverage: [],
  bindings: []
});

const pairFootPartIds = (side: 'left' | 'right'): readonly string[] => [
  `foot.${side}.root`,
  `foot.${side}.sole`,
  `foot.${side}.toe.inner`,
  `foot.${side}.claw.inner`,
  `foot.${side}.toe.outer`,
  `foot.${side}.claw.outer`
];

const pairedFootSupport = (
  side: 'left' | 'right',
  swapDigitRegions = false
): Extract<AuthoringSupport, { kind: 'foot' }> => {
  const physicalSide = (digitId: 'inner' | 'outer'): 'inner' | 'outer' =>
    swapDigitRegions
      ? digitId === 'inner' ? 'outer' : 'inner'
      : digitId;
  return {
    kind: 'foot',
    contact: 'grounded',
    rootPartId: `foot.${side}.root`,
    solePartIds: [`foot.${side}.sole`],
    digits: (['inner', 'outer'] as const).map((digitId) => ({
      digitId,
      toePartIds: [`foot.${side}.toe.${physicalSide(digitId)}`],
      clawPartIds: [`foot.${side}.claw.${physicalSide(digitId)}`]
    }))
  };
};

const pairedFootProfile = (
  swapRightDigitRegions = false
): AuthoringProfile => ({
  ...profileFor({ kind: 'none' }),
  slots: (['left', 'right'] as const).map((side) => ({
    slotId: `support.${side}`,
    structuralRole: 'accent' as const,
    qualityStage: 'structure' as const,
    partIds: pairFootPartIds(side),
    parentSlotIds: [],
    spatialRelations: [side],
    facing: 'forward' as const,
    symmetry: { kind: 'paired' as const, pairId: 'pair.feet' },
    support: pairedFootSupport(
      side,
      side === 'right' && swapRightDigitRegions
    )
  }))
});

const pairedFootProject = (): ProjectDocument => {
  const empty = createProjectFromInput({
    id: 'support-paired-feet',
    name: 'Support paired feet',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'support_paired_feet',
    createdAt: '2026-08-08T00:00:00.000Z'
  }, 'support-pair-0001');
  const parts = [
    {
      kind: 'mass' as const,
      partId: 'body',
      parentPartId: null,
      materialId: 'fur',
      center: [0, 5, 0] as Point,
      radii: [4, 2, 2] as Point
    },
    ...(['left', 'right'] as const).flatMap((side) => {
      const sign = side === 'left' ? -1 : 1;
      const rootId = `foot.${side}.root`;
      return [
        {
          kind: 'mass' as const,
          partId: rootId,
          parentPartId: 'body',
          materialId: 'fur',
          center: [3 * sign, 2, 0] as Point,
          radii: [2, 1, 1] as Point
        },
        {
          kind: 'plate' as const,
          partId: `foot.${side}.sole`,
          parentPartId: rootId,
          materialId: 'sole',
          plane: 'xz' as const,
          origin: [side === 'left' ? -5 : 1, 0, -1] as Point,
          size: [4, 2] as const,
          thickness: 1
        },
        ...(['inner', 'outer'] as const).flatMap((digitId) => {
          const absoluteX = digitId === 'inner' ? 2 : 4;
          const toeId = `foot.${side}.toe.${digitId}`;
          return [
            {
              kind: 'mass' as const,
              partId: toeId,
              parentPartId: rootId,
              materialId: 'fur',
              center: [absoluteX * sign, 1, -2] as Point,
              radii: [1, 1, 1] as Point
            },
            {
              kind: 'mass' as const,
              partId: `foot.${side}.claw.${digitId}`,
              parentPartId: toeId,
              materialId: 'claw',
              center: [absoluteX * sign, 1, -4] as Point,
              radii: [1, 1, 1] as Point
            }
          ];
        })
      ];
    })
  ];
  const modeled = execute(empty, 'support-pair-model', [{
    name: 'model.parts.upsert',
    payload: {
      parts,
      materials: [
        { id: 'fur', baseColor: '#A05030' },
        { id: 'sole', baseColor: '#38231F' },
        { id: 'claw', baseColor: '#E8D9B5' }
      ]
    }
  }]);
  return {
    ...modeled,
    intent: {
      subject: 'Audited paired feet',
      forward: 'north',
      grounding: 'grounded',
      symmetry: { kind: 'bilateral', planeTwice: 0 },
      features: []
    }
  };
};

for (const direction of [
  'north',
  'south',
  'east',
  'west'
] as const) {
  const evaluation = evaluateSupportQuality(
    footProject({ direction }),
    profileFor(footSupport())
  );
  assert.equal(
    evaluation.ready,
    true,
    `${direction} foot must satisfy the same frame-derived contract: ` +
      evaluation.issues.map((entry) => entry.message).join('; ')
  );
  assert.equal(evaluation.violations.length, 0);
  assert.ok((evaluation.statuses[0]?.toeForwardMarginCells ?? 0) > 0);
  assert.ok((evaluation.statuses[0]?.clawForwardMarginCells ?? 0) > 0);
  assert.ok((evaluation.statuses[0]?.groundContactCellCount ?? 0) > 0);
  assert.ok(
    (evaluation.statuses[0]?.downwardExposedSoleCellCount ?? 0) > 0
  );
}

const reversedToe = evaluateSupportQuality(
  footProject({ direction: 'north', reversedToe: true }),
  profileFor(footSupport())
);
assert.equal(reversedToe.ready, false);
assert.ok(reversedToe.violations.some(
  (entry) => entry.code === 'authoring.plan.support_toe_direction_invalid'
));

const reversedClaw = evaluateSupportQuality(
  footProject({ direction: 'north', reversedClaw: true }),
  profileFor(footSupport())
);
assert.equal(reversedClaw.ready, false);
assert.ok(reversedClaw.violations.some(
  (entry) => entry.code === 'authoring.plan.support_claw_direction_invalid'
));

const floatingSole = evaluateSupportQuality(
  footProject({ direction: 'north', verticalOffset: 1 }),
  profileFor(footSupport())
);
assert.equal(floatingSole.ready, false);
assert.ok(floatingSole.violations.some(
  (entry) => entry.code === 'authoring.plan.support_ground_contact_invalid'
));

const penetratingSoleDocument = footProject({
  direction: 'north',
  soleOriginOffset: -1,
  soleThickness: 2
});
const penetratingSole = evaluateSupportQuality(
  penetratingSoleDocument,
  profileFor(footSupport())
);
assert.ok(
  (penetratingSole.statuses[0]?.groundContactCellCount ?? 0) > 0,
  'penetration fixture must retain y=0 contact so the regression is not a floating-foot duplicate'
);
assert.ok(penetratingSole.violations.some((entry) =>
  entry.code === 'authoring.plan.support_ground_contact_invalid' &&
  entry.message.includes('penetrates below')
));

const liftedFreeFootDocument = footProject({
  direction: 'north',
  verticalOffset: 1
});
const liftedFreeFoot = evaluateSupportQuality(
  {
    ...liftedFreeFootDocument,
    intent: {
      ...liftedFreeFootDocument.intent!,
      grounding: 'free'
    }
  },
  profileFor(footSupport({ contact: 'free' }))
);
assert.equal(
  liftedFreeFoot.ready,
  true,
  'a deliberately lifted foot retains sole and forward anatomy without requiring y=0 contact'
);

const reversedFreeFootDocument = footProject({
  direction: 'north',
  reversedToe: true,
  verticalOffset: 1
});
const reversedFreeFoot = evaluateSupportQuality(
  {
    ...reversedFreeFootDocument,
    intent: {
      ...reversedFreeFootDocument.intent!,
      grounding: 'free'
    }
  },
  profileFor(footSupport({ contact: 'free' }))
);
assert.ok(reversedFreeFoot.violations.some(
  (entry) => entry.code === 'authoring.plan.support_toe_direction_invalid'
));

const swappedAnatomy = evaluateSupportQuality(
  footProject({ direction: 'north' }),
  profileFor(footSupport({
    digits: [{
      digitId: 'center',
      toePartIds: ['foot.claw'],
      clawPartIds: ['foot.toe']
    }]
  }))
);
assert.equal(swappedAnatomy.ready, false);
assert.ok(swappedAnatomy.violations.some(
  (entry) => entry.code === 'authoring.plan.support_hierarchy_invalid'
));

const partial = evaluateSupportQuality(
  footProject({ direction: 'north' }),
  profileFor(
    footSupport({
      digits: [{
        digitId: 'center',
        toePartIds: ['foot.toe'],
        clawPartIds: ['foot.future-claw']
      }]
    }),
    ['foot.root', 'foot.sole', 'foot.toe', 'foot.future-claw']
  )
);
assert.equal(partial.ready, false);
assert.equal(partial.statuses[0]?.state, 'incomplete');
assert.deepEqual(partial.statuses[0]?.missingPartIds, ['foot.future-claw']);
assert.equal(
  partial.violations.length,
  0,
  'planned but not-yet-authored support parts must block delivery without rejecting partial authoring'
);

const base = evaluateSupportQuality(
  footProject({ direction: 'north' }),
  profileFor({
    kind: 'base',
    contact: 'grounded',
    supportPartIds: ['foot.sole']
  }, ['foot.sole'])
);
assert.equal(base.ready, true);
assert.ok((base.statuses[0]?.groundContactCellCount ?? 0) > 0);

const penetratingBase = evaluateSupportQuality(
  penetratingSoleDocument,
  profileFor({
    kind: 'base',
    contact: 'grounded',
    supportPartIds: ['foot.sole']
  }, ['foot.sole'])
);
assert.ok(
  (penetratingBase.statuses[0]?.groundContactCellCount ?? 0) > 0
);
assert.ok(penetratingBase.violations.some((entry) =>
  entry.code === 'authoring.plan.support_ground_contact_invalid' &&
  entry.message.includes('penetrates below')
));

const pairedDocument = pairedFootProject();
const exactPairProfile = pairedFootProfile();
const exactPairSymmetry = evaluateSymmetryQuality(
  pairedDocument,
  exactPairProfile
);
assert.equal(
  exactPairSymmetry.ready,
  true,
  exactPairSymmetry.issues.map((entry) => entry.message).join('; ')
);
const exactPairSupport = evaluateSupportQuality(
  pairedDocument,
  exactPairProfile
);
assert.equal(
  exactPairSupport.ready,
  true,
  exactPairSupport.issues.map((entry) => entry.message).join('; ')
);

const swappedPairProfile = pairedFootProfile(true);
assert.equal(
  evaluateSymmetryQuality(pairedDocument, swappedPairProfile).ready,
  true,
  'whole-slot reflection deliberately cannot observe swapped digit semantics'
);
const swappedPairSupport = evaluateSupportQuality(
  pairedDocument,
  swappedPairProfile
);
assert.ok(swappedPairSupport.violations.some((entry) =>
  entry.code === 'authoring.plan.support_pair_reflection_invalid' &&
  entry.message.includes('digit:inner') &&
  entry.message.includes('digit:outer')
));

const mismatchedBasePairProfile: AuthoringProfile = {
  ...exactPairProfile,
  slots: exactPairProfile.slots.map((slot) => ({
    ...slot,
    support: {
      kind: 'base' as const,
      contact: 'grounded' as const,
      supportPartIds: [slot.slotId.endsWith('left')
        ? 'foot.left.sole'
        : 'foot.right.toe.inner']
    }
  }))
};
assert.equal(
  evaluateSymmetryQuality(pairedDocument, mismatchedBasePairProfile).ready,
  true
);
assert.ok(evaluateSupportQuality(
  pairedDocument,
  mismatchedBasePairProfile
).violations.some((entry) =>
  entry.code === 'authoring.plan.support_pair_reflection_invalid'
));

const configuredFootSelection: AuthoringSelectionInput = {
  archetype: {
    id: 'archetype.composable-form',
    version: AUTHORING_PROFILE_SCHEMA_VERSION
  },
  track: 'essential',
  faceMode: 'none',
  face: null,
  specialists: [],
  claims: [{
    authority: {
      id: 'archetype.composable-form',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    },
    criterionId: 'criterion.structure-graph',
    basis: 'requested',
    referenceIds: ['intent.subject'],
    rationale: 'The regression fixture declares one grounded foot chain.'
  }],
  slots: [
    {
      slotId: 'core.primary',
      structuralRole: 'core',
      qualityStage: 'silhouette',
      partIds: ['body'],
      parentSlotIds: [],
      spatialRelations: [],
      facing: null,
      symmetry: { kind: 'asymmetric' },
      support: { kind: 'none' }
    },
    {
      slotId: 'support.primary',
      structuralRole: 'accent',
      qualityStage: 'structure',
      partIds: ['foot.root', 'foot.sole', 'foot.toe', 'foot.claw'],
      parentSlotIds: ['core.primary'],
      spatialRelations: ['below'],
      facing: 'forward',
      symmetry: { kind: 'asymmetric' },
      support: footSupport()
    }
  ],
  coverage: [],
  bindings: []
};
const configuredFoot = execute(
  footProject({ direction: 'north' }),
  'support-configure-atomic-transform',
  [{
    name: 'project.authoring.configure',
    payload: configuredFootSelection
  }]
);
const configuredFootSnapshot = JSON.stringify(configuredFoot);
const rejectedLift = executeAgentCommandBatch(configuredFoot, {
  batchId: 'support-reject-lifted-foot',
  baseProjectId: configuredFoot.id,
  baseRevision: configuredFoot.revision,
  operations: [{
    name: 'model.parts.transform',
    payload: {
      rootPartId: 'foot.root',
      by: [0, 1, 0]
    }
  }]
});
assert.equal(rejectedLift.ok, false);
if (!rejectedLift.ok) {
  assert.equal(rejectedLift.error.code, 'invalid_state');
  assert.match(
    rejectedLift.error.message,
    /canonical contact at lattice y=0/u
  );
}
assert.equal(
  JSON.stringify(configuredFoot),
  configuredFootSnapshot,
  'a transform that breaks grounded support must publish no intermediate document'
);
