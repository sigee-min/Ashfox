import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  evaluateProjectIntentRequirements,
  executeSystemCommandBatch,
  normalizeProjectIntent,
  projectGroundingCorrection,
  readProjectIntent,
  type CommandBatch,
  type ProjectDocument
} from '../src';

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) =>
  executeSystemCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    }
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

const normalized = normalizeProjectIntent({
  subject: '  Golden   utility truck ',
  forward: 'east',
  grounding: 'grounded',
  features: [
    'Readable cab silhouette',
    '  Connected   bonnet and cab ',
    'Readable cab silhouette'
  ]
});
assert.equal(normalized.ok, true);
if (!normalized.ok) throw new Error('Expected normalized intent.');
assert.deepEqual(normalized.intent, {
  subject: 'Golden utility truck',
  forward: 'east',
  grounding: 'grounded',
  features: [
    'Connected bonnet and cab',
    'Readable cab silhouette'
  ]
});

const referenceDriven = normalizeProjectIntent({
  subject: '  Clockwork   hound ',
  forward: 'west',
  grounding: 'grounded',
  features: ['Readable sensor head'],
  references: [{
    id: 'reference.front',
    kind: 'image',
    description: '  Front view of a compact clockwork hound ',
    cues: [
      'Four load-bearing legs',
      '  Exposed   shoulder joints ',
      'Four load-bearing legs'
    ],
    contentHash: ' sha256:abc123 '
  }]
});
assert.equal(referenceDriven.ok, true);
if (!referenceDriven.ok) {
  throw new Error('Expected normalized reference observations.');
}
assert.deepEqual(referenceDriven.intent.references, [{
  id: 'reference.front',
  kind: 'image',
  description: 'Front view of a compact clockwork hound',
  cues: ['Exposed shoulder joints', 'Four load-bearing legs'],
  contentHash: 'sha256:abc123'
}]);

const duplicateReference = normalizeProjectIntent({
  subject: 'Clockwork hound',
  forward: 'west',
  grounding: 'grounded',
  features: [],
  references: [
    {
      id: 'reference.front',
      kind: 'image',
      description: 'Front view',
      cues: []
    },
    {
      id: 'reference.front',
      kind: 'text',
      description: 'Notes',
      cues: []
    }
  ]
});
assert.equal(duplicateReference.ok, false);
if (duplicateReference.ok) {
  throw new Error('Expected duplicate reference ID rejection.');
}
assert.ok(
  duplicateReference.issues.some(
    (issue) => issue.path === 'references[1].id'
  )
);

const unknownContract = normalizeProjectIntent({
  subject: 'Truck',
  forward: 'north',
  grounding: 'free',
  features: [],
  unexpected: true
});
assert.equal(unknownContract.ok, false);
if (unknownContract.ok) throw new Error('Expected unknown field rejection.');
assert.equal(unknownContract.issues[0]?.path, 'unexpected');

const firstIntent = execute(empty, 'intent-first', [{
  name: 'project.intent.set',
  payload: {
    subject: 'Golden utility truck',
    forward: 'east',
    grounding: 'grounded',
    features: ['Connected bonnet and cab'],
    references: [{
      id: 'reference.side',
      kind: 'image',
      description: 'Side view of the target utility truck',
      cues: ['Cab connects directly to the bonnet'],
      contentHash: 'sha256:utility-truck-side'
    }]
  }
}]);
assert.equal(firstIntent.ok, true);
if (!firstIntent.ok) throw new Error(firstIntent.error.message);
assert.deepEqual(firstIntent.document.intent, {
  subject: 'Golden utility truck',
  forward: 'east',
  grounding: 'grounded',
  features: ['Connected bonnet and cab'],
  references: [{
    id: 'reference.side',
    kind: 'image',
    description: 'Side view of the target utility truck',
    cues: ['Cab connects directly to the bonnet'],
    contentHash: 'sha256:utility-truck-side'
  }]
});

const replacement = execute(
  firstIntent.document,
  'intent-replacement',
  [{
    name: 'project.intent.set',
    payload: {
      subject: 'Cargo rocket'
    }
  }]
);
assert.equal(replacement.ok, true);
if (!replacement.ok) throw new Error(replacement.error.message);
assert.deepEqual(
  replacement.document.intent,
  {
    subject: 'Cargo rocket',
    forward: 'north',
    grounding: 'free',
    features: []
  },
  'intent set must replace the complete current intent'
);

const unexpectedIntentInput = execute(
  replacement.document,
  'intent-unexpected-input',
  [{
    name: 'project.intent.set',
    payload: {
      subject: 'Cargo rocket',
      unexpected: true
    }
  } as unknown as CommandBatch['operations'][number]]
);
assert.equal(unexpectedIntentInput.ok, false);
if (unexpectedIntentInput.ok) {
  throw new Error('Expected unknown intent input rejection.');
}
assert.equal(
  unexpectedIntentInput.error.path,
  'operations[0].payload.unexpected'
);

const modeled = execute(replacement.document, 'intent-model', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'mass',
      partId: 'body',
      materialId: 'gold',
      center: [0, 2, 0],
      radii: [1, 1, 1]
    }],
    materials: [{
      id: 'gold',
      baseColor: '#D99A32'
    }]
  }
}]);
assert.equal(modeled.ok, true);
if (!modeled.ok) throw new Error(modeled.error.message);

const grounded = execute(modeled.document, 'intent-grounded', [{
  name: 'project.intent.set',
  payload: {
    subject: 'Golden utility truck',
    grounding: 'grounded',
    features: ['Stable ground contact']
  }
}]);
assert.equal(grounded.ok, true);
if (!grounded.ok) throw new Error(grounded.error.message);
const groundingReport = evaluateProjectIntentRequirements(
  grounded.document
);
assert.equal(groundingReport.machineSatisfied, false);
assert.equal(
  groundingReport.issues[0]?.code,
  'grounding_mismatch'
);
assert.deepEqual(
  projectGroundingCorrection(grounded.document),
  {
    rootPartId: 'body',
    by: [0, -1, 0]
  }
);

const fixed = execute(grounded.document, 'intent-ground-fix', [{
  name: 'model.parts.transform',
  payload: {
    rootPartId: 'body',
    by: [0, -1, 0]
  }
}]);
assert.equal(fixed.ok, true);
if (!fixed.ok) throw new Error(fixed.error.message);
assert.equal(
  evaluateProjectIntentRequirements(fixed.document).machineSatisfied,
  true
);
assert.equal(projectGroundingCorrection(fixed.document), null);

const invalidPersistedIntent = structuredClone(fixed.document) as unknown as {
  intent: unknown;
};
invalidPersistedIntent.intent = {
  subject: 'Invalid project',
  forward: 'north',
  grounding: 'free',
  unexpected: true
};
const persistedResult = readProjectIntent(
  invalidPersistedIntent as Pick<ProjectDocument, 'intent'>
);
assert.equal(persistedResult.ok, false);

const missingIntent = evaluateProjectIntentRequirements(empty);
assert.equal(missingIntent.intentPresent, false);
assert.equal(missingIntent.machineSatisfied, false);
assert.equal(missingIntent.issues[0]?.code, 'intent_missing');
