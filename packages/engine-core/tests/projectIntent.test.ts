import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  evaluateProjectIntentRequirements,
  evaluateProductionReadiness,
  executeCommandBatch,
  normalizeProjectIntent,
  parseProjectDocument,
  readProjectIntent,
  validateProjectDocument,
  type CommandBatch,
  type PartSpec,
  type ProjectDocument,
  type ProjectIntent
} from '../src';

const body: PartSpec = {
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'core',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xy',
  origin: [-2, 0, 0],
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4]
  ],
  thickness: 4
};

const mirroredPart = (
  partId: 'left' | 'right'
): PartSpec => ({
  kind: 'mass',
  partId,
  parentPartId: 'body',
  materialId: 'accent',
  joint: { kind: 'fixed' },
  attachment:
    partId === 'left'
      ? {
          parentAnchor: [-2, 2, 2],
          partAnchor: [-2, 2, 2]
        }
      : {
          parentAnchor: [2, 2, 2],
          partAnchor: [2, 2, 2]
        },
  center: partId === 'left' ? [-3, 2, 2] : [3, 2, 2],
  radii: [1, 1, 1],
  profile: 'hard'
});

const baseIntent: ProjectIntent = {
  subject: 'Mirrored sentinel',
  forward: 'north',
  grounding: 'grounded',
  requiredFeatures: [
    'Human confirms the silhouette reads as the requested sentinel.',
    'Human verifies the focal parts remain legible at gameplay distance.'
  ],
  requiredPartIds: ['body', 'left', 'right'],
  requiredMaterialIds: ['accent', 'core'],
  requiredClipIds: ['idle'],
  symmetryPairs: [{
    axis: 'x',
    plane: 0,
    leftPartId: 'left',
    rightPartId: 'right'
  }]
};

const setIntent = (
  intent: ProjectIntent
): CommandBatch['operations'][number] => ({
  name: 'project.intent.set',
  payload: intent
});

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source: 'agent' }
  );

const empty = createProjectFromInput(
  {
    id: 'project-intent-contract',
    name: 'Intent contract',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'intent_contract',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'intent-0001'
);

const authored = execute(empty, 'intent-author-complete', [
  setIntent({
    ...baseIntent,
    subject: '  Mirrored   sentinel  ',
    requiredFeatures: [
      baseIntent.requiredFeatures[1],
      baseIntent.requiredFeatures[0]
    ],
    requiredPartIds: ['right', 'body', 'left'],
    requiredMaterialIds: ['core', 'accent']
  }),
  {
    name: 'model.parts.upsert',
    payload: {
      parts: [
        mirroredPart('right'),
        body,
        mirroredPart('left')
      ].map(({ attachment: _attachment, ...part }) => part),
      materials: [
        { id: 'core', baseColor: '#485568' },
        { id: 'accent', baseColor: '#D98A42' }
      ]
    }
  },
  {
    name: 'animation.clip.upsert',
    payload: {
      id: 'idle',
      name: 'Idle',
      durationSeconds: 1,
      fps: 20,
      loop: 'loop'
    }
  },
  {
    name: 'animation.channels.upsert',
    payload: {
      clipId: 'idle',
      channels: [{
        id: 'body.rotation',
        targetNodeId: 'bone:body',
        property: 'rotation',
        keys: [
          {
            id: 'idle-start',
            timeSeconds: 0,
            value: [0, 0, 0]
          },
          {
            id: 'idle-end',
            timeSeconds: 1,
            value: [0, 0, 0]
          }
        ]
      }]
    }
  }
]);
assert.equal(authored.ok, true);
if (!authored.ok) throw new Error(authored.error.message);
const complete = authored.document;

assert.equal(complete.intent?.subject, 'Mirrored sentinel');
assert.deepEqual(
  complete.intent?.requiredFeatures,
  [...baseIntent.requiredFeatures].sort()
);
assert.deepEqual(
  complete.intent?.requiredPartIds,
  ['body', 'left', 'right']
);
assert.deepEqual(
  complete.intent?.requiredMaterialIds,
  ['accent', 'core']
);
assert.equal(readProjectIntent(complete).ok, true);
assert.equal(validateProjectDocument(complete).valid, true);

const completeReadiness = evaluateProductionReadiness(complete);
assert.equal(completeReadiness.mechanicallyReady, true);
assert.equal(completeReadiness.semanticReviewRequired, true);
assert.equal(completeReadiness.counts.intentPresent, true);
assert.equal(completeReadiness.counts.symmetryPairs, 1);
assert.equal(completeReadiness.counts.symmetryMismatches, 0);
assert.ok(completeReadiness.counts.groundSupportCells > 0);
assert.equal(
  completeReadiness.counts.uniformCenterOfMassSupported,
  true
);
assert.deepEqual(completeReadiness.findings, []);

const reopened = parseProjectDocument(
  JSON.parse(JSON.stringify(complete))
);
assert.deepEqual(reopened.intent, complete.intent);

const missingIntent = structuredClone(complete);
delete missingIntent.intent;
assert.equal(validateProjectDocument(missingIntent).valid, true);
assert.ok(
  evaluateProductionReadiness(missingIntent).findings.some(
    (finding) => finding.code === 'production.intent_missing'
  )
);

const missingRequirements = execute(
  complete,
  'intent-missing-requirements',
  [setIntent({
    ...baseIntent,
    requiredPartIds: [...baseIntent.requiredPartIds, 'tail'],
    requiredMaterialIds: [
      ...baseIntent.requiredMaterialIds,
      'warning'
    ],
    requiredClipIds: [
      ...baseIntent.requiredClipIds,
      '__proto__',
      'walk'
    ]
  })]
);
assert.equal(missingRequirements.ok, true);
if (!missingRequirements.ok) {
  throw new Error(missingRequirements.error.message);
}
const missingCodes = evaluateProductionReadiness(
  missingRequirements.document
).findings.map((finding) => finding.code);
assert.ok(
  missingCodes.includes('production.intent_required_part_missing')
);
assert.ok(
  missingCodes.includes(
    'production.intent_required_material_missing'
  )
);
assert.ok(
  missingCodes.includes('production.intent_required_clip_missing')
);
const missingClipFinding = evaluateProductionReadiness(
  missingRequirements.document
).findings.find(
  (finding) =>
    finding.code === 'production.intent_required_clip_missing'
);
assert.deepEqual(
  missingClipFinding?.clipIds,
  ['__proto__', 'walk'],
  'required clip lookup must only accept own persisted animation IDs'
);

const emptyRequiredClip = structuredClone(complete);
emptyRequiredClip.animations.idle = {
  ...emptyRequiredClip.animations.idle,
  channels: {}
};
const emptyRequiredClipReadiness =
  evaluateProductionReadiness(emptyRequiredClip);
assert.equal(
  emptyRequiredClipReadiness.counts.emptyRequiredClips,
  1
);
assert.ok(
  emptyRequiredClipReadiness.findings.some(
    (finding) =>
      finding.code ===
      'production.intent_required_clip_channels_missing'
  )
);

const airborne = execute(
  complete,
  'intent-grounding-mismatch',
  [setIntent({
    ...baseIntent,
    grounding: 'airborne'
  })]
);
assert.equal(airborne.ok, true);
if (!airborne.ok) throw new Error(airborne.error.message);
assert.ok(
  evaluateProductionReadiness(airborne.document).findings.some(
    (finding) =>
      finding.code === 'production.intent_grounding_mismatch'
  )
);

const unstableBase = createProjectFromInput(
  {
    id: 'project-static-support',
    name: 'Static support',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'static_support',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'support-0001'
);
const unstable = execute(
  unstableBase,
  'intent-static-support',
  [
    setIntent({
      subject: 'Cantilever',
      forward: 'north',
      grounding: 'grounded',
      requiredFeatures: [
        'Human verifies the intended cantilever silhouette.'
      ],
      requiredPartIds: ['cantilever'],
      requiredMaterialIds: ['core'],
      requiredClipIds: []
    }),
    {
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'segment',
          partId: 'cantilever',
          parentPartId: null,
          materialId: 'core',
          joint: { kind: 'fixed' },
          points: [
            [0, 1, 0],
            [0, 5, 0],
            [10, 5, 0]
          ],
          radii: [
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1]
          ],
          profile: 'hard'
        }],
        materials: [{
          id: 'core',
          baseColor: '#485568'
        }]
      }
    }
  ]
);
assert.equal(unstable.ok, true);
if (!unstable.ok) throw new Error(unstable.error.message);
const unstableReadiness =
  evaluateProductionReadiness(unstable.document);
assert.equal(
  unstableReadiness.counts.uniformCenterOfMassSupported,
  false
);
assert.ok(
  unstableReadiness.findings.some(
    (finding) =>
      finding.code === 'production.intent_grounding_unstable'
  )
);

const groundedWithForeign = structuredClone(complete);
const sourceCube = Object.values(
  groundedWithForeign.scene.nodes
).find((node) => node.kind === 'cube');
if (!sourceCube || sourceCube.kind !== 'cube') {
  throw new Error('Expected compiled cube fixture.');
}
const {
  generation: _discardedGeneration,
  ...foreignCube
} = sourceCube;
const foreignCubeId = 'raw-below-ground';
groundedWithForeign.scene = {
  roots: [
    ...groundedWithForeign.scene.roots,
    foreignCubeId
  ].sort(),
  nodes: {
    ...groundedWithForeign.scene.nodes,
    [foreignCubeId]: {
      ...foreignCube,
      id: foreignCubeId,
      name: 'Raw below-ground geometry',
      parentId: null,
      bounds: {
        from: [100, -5, 100],
        to: [101, -4, 101]
      }
    }
  }
};
assert.equal(
  validateProjectDocument(groundedWithForeign).valid,
  true,
  'non-overlapping raw geometry is structurally valid'
);
const foreignIntentReport = evaluateProjectIntentRequirements(
  groundedWithForeign
);
assert.equal(foreignIntentReport.machineSatisfied, false);
assert.equal(foreignIntentReport.machineChecksComplete, false);
assert.equal(
  foreignIntentReport.counts.unverifiableGeometry,
  1
);
assert.ok(
  foreignIntentReport.issues.some(
    (issue) => issue.code === 'grounding_unverifiable'
  )
);
const foreignReadiness = evaluateProductionReadiness(
  groundedWithForeign
);
assert.equal(foreignReadiness.mechanicallyReady, false);
assert.ok(
  foreignReadiness.findings.some(
    (finding) =>
      finding.code ===
      'production.intent_grounding_unverifiable'
  )
);

const wrongPlane = execute(
  complete,
  'intent-symmetry-mismatch',
  [setIntent({
    ...baseIntent,
    symmetryPairs: [{
      ...baseIntent.symmetryPairs![0],
      plane: 0.5
    }]
  })]
);
assert.equal(wrongPlane.ok, true);
if (!wrongPlane.ok) throw new Error(wrongPlane.error.message);
assert.ok(
  evaluateProductionReadiness(wrongPlane.document).findings.some(
    (finding) =>
      finding.code === 'production.intent_symmetry_mismatch'
  )
);

const projectionDrift = structuredClone(complete);
const leftGeometry = Object.values(
  projectionDrift.scene.nodes
).find(
  (node) =>
    node.generation?.role === 'geometry' &&
    node.generation.partId === 'left'
);
if (!leftGeometry) {
  throw new Error('Expected left compiled geometry fixture.');
}
delete projectionDrift.scene.nodes[leftGeometry.id];
assert.equal(validateProjectDocument(projectionDrift).valid, false);
const unavailableIntentReport =
  evaluateProjectIntentRequirements(projectionDrift);
assert.equal(unavailableIntentReport.machineSatisfied, false);
assert.equal(
  unavailableIntentReport.machineChecksComplete,
  false
);
assert.equal(
  unavailableIntentReport.counts.symmetryUnevaluated,
  1
);
assert.ok(
  unavailableIntentReport.issues.some(
    (issue) => issue.code === 'evaluation_unavailable'
  )
);
assert.ok(
  evaluateProductionReadiness(projectionDrift).findings.some(
    (finding) =>
      finding.code ===
      'production.intent_evaluation_unavailable'
  )
);

const missingSymmetryPart = execute(
  complete,
  'intent-symmetry-part-missing',
  [setIntent({
    ...baseIntent,
    symmetryPairs: [{
      axis: 'x',
      plane: 0,
      leftPartId: 'left',
      rightPartId: 'ghost'
    }]
  })]
);
assert.equal(missingSymmetryPart.ok, true);
if (!missingSymmetryPart.ok) {
  throw new Error(missingSymmetryPart.error.message);
}
assert.ok(
  evaluateProductionReadiness(
    missingSymmetryPart.document
  ).findings.some(
    (finding) =>
      finding.code === 'production.intent_symmetry_part_missing'
  )
);

const humanReviewOnly = execute(
  complete,
  'intent-human-review-wording',
  [setIntent({
    ...baseIntent,
    subject: 'A subject whose identity still requires human review',
    requiredFeatures: [
      'A human decides whether this actually resembles the request.'
    ]
  })]
);
assert.equal(humanReviewOnly.ok, true);
if (!humanReviewOnly.ok) {
  throw new Error(humanReviewOnly.error.message);
}
assert.equal(
  evaluateProductionReadiness(humanReviewOnly.document).mechanicallyReady,
  true,
  'readiness must not pretend to judge subject identity or visual appeal'
);

const invalidPlane = execute(
  complete,
  'intent-invalid-quarter-plane',
  [setIntent({
    ...baseIntent,
    symmetryPairs: [{
      ...baseIntent.symmetryPairs![0],
      plane: 0.25
    }]
  })]
);
assert.equal(invalidPlane.ok, false);
if (!invalidPlane.ok) {
  assert.equal(invalidPlane.error.code, 'invalid_payload');
  assert.match(invalidPlane.error.path ?? '', /\.plane$/);
}

const normalizedHalfPlane = normalizeProjectIntent({
  ...baseIntent,
  symmetryPairs: [{
    ...baseIntent.symmetryPairs![0],
    plane: -0.5
  }]
});
assert.equal(normalizedHalfPlane.ok, true);

const noChange = execute(
  complete,
  'intent-identical-no-change',
  [setIntent(complete.intent!)]
);
assert.equal(noChange.ok, false);
if (!noChange.ok) assert.equal(noChange.error.code, 'no_change');

const reversedSymmetryNoChange = execute(
  complete,
  'intent-reversed-symmetry-no-change',
  [setIntent({
    ...complete.intent!,
    symmetryPairs: [{
      ...complete.intent!.symmetryPairs![0],
      leftPartId:
        complete.intent!.symmetryPairs![0].rightPartId,
      rightPartId:
        complete.intent!.symmetryPairs![0].leftPartId
    }]
  })]
);
assert.equal(reversedSymmetryNoChange.ok, false);
if (!reversedSymmetryNoChange.ok) {
  assert.equal(reversedSymmetryNoChange.error.code, 'no_change');
}

const malformed = structuredClone(complete);
malformed.intent = {
  ...malformed.intent!,
  requiredFeatures: []
};
const malformedReport = validateProjectDocument(malformed);
assert.equal(malformedReport.valid, false);
assert.ok(
  malformedReport.findings.some(
    (finding) => finding.code === 'document.invalid_intent'
  )
);
assert.throws(
  () => parseProjectDocument(JSON.parse(JSON.stringify(malformed))),
  /violates/
);
