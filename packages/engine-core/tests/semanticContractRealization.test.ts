import assert from 'node:assert/strict';

import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  createAuthoringProfile,
  createProjectFromInput,
  normalizeProjectIntent,
  type AuthoringSelectionInput,
  type AuthoringSlotAssignment,
  type ProjectDocument
} from '../src';

const normalized = normalizeProjectIntent({
  subject: 'Standing paired-wing creature with two eyes',
  forward: 'north',
  grounding: 'grounded',
  symmetry: { kind: 'bilateral', planeTwice: 0 },
  semanticContract: {
    subjectDomain: 'organism',
    canonicalSupport: { kind: 'standing-feet' },
    face: {
      kind: 'full',
      eyeConfiguration: 'paired',
      nasal: 'absent',
      oral: 'absent'
    },
    supportedSurfaces: [{
      id: 'wing.primary',
      role: 'wing',
      configuration: 'paired',
      extension: 'lateral'
    }]
  },
  features: [],
  references: [{
    id: 'reference.design',
    kind: 'text',
    description: 'Fixture explicitly omits nasal and oral structures',
    cues: ['Paired eyes', 'Paired wings', 'Neutral standing feet']
  }]
});
assert.equal(normalized.ok, true);
if (!normalized.ok) throw new Error(normalized.issues[0]?.message);

const base = createProjectFromInput({
  id: 'semantic-contract-realization',
  name: 'Semantic contract realization',
  createdAt: '2026-08-08T00:00:00.000Z'
}, 'semantic-contract-0001');
const document: ProjectDocument = { ...base, intent: normalized.intent };

const foot = (
  side: 'left' | 'right'
): AuthoringSlotAssignment => ({
  slotId: `foot.${side}`,
  structuralRole: 'articulated',
  qualityStage: 'structure',
  partIds: [
    `foot.${side}.root`,
    `foot.${side}.sole`,
    `foot.${side}.toe`
  ],
  parentSlotIds: ['core'],
  spatialRelations: [side],
  facing: 'forward',
  symmetry: { kind: 'paired', pairId: 'pair.feet' },
  support: {
    kind: 'foot',
    contact: 'grounded',
    rootPartId: `foot.${side}.root`,
    solePartIds: [`foot.${side}.sole`],
    digits: [{
      digitId: 'front',
      toePartIds: [`foot.${side}.toe`],
      clawPartIds: []
    }]
  },
  span: { kind: 'none' }
});

const wing = (
  side: 'left' | 'right'
): AuthoringSlotAssignment => ({
  slotId: `wing.${side}`,
  structuralRole: 'span',
  qualityStage: 'silhouette',
  partIds: [
    `wing.${side}.root`,
    `wing.${side}.spar.front`,
    `wing.${side}.spar.rear`,
    `wing.${side}.membrane`
  ],
  parentSlotIds: ['core'],
  spatialRelations: [side],
  facing: null,
  symmetry: { kind: 'paired', pairId: 'pair.wings' },
  support: { kind: 'none' },
  span: {
    kind: 'supported-surface',
    obligationId: 'wing.primary',
    rootPartIds: [`wing.${side}.root`],
    spars: [{
      sparId: 'front',
      partIds: [`wing.${side}.spar.front`]
    }, {
      sparId: 'rear',
      partIds: [`wing.${side}.spar.rear`]
    }],
    membranes: [{
      membraneId: 'main',
      partIds: [`wing.${side}.membrane`],
      boundedBySparIds: ['front', 'rear']
    }]
  }
});

const selection: AuthoringSelectionInput = {
  archetype: {
    id: 'archetype.composable-form',
    version: AUTHORING_PROFILE_SCHEMA_VERSION
  },
  track: 'essential',
  restPose: { kind: 'canonical-neutral', mode: 'standing' },
  faceMode: 'full',
  face: {
    hostSlotId: 'face.host',
    mouthState: 'absent',
    components: [{
      component: 'eye',
      form: 'eye',
      configuration: {
        kind: 'paired',
        leftSlotId: 'eye.left',
        rightSlotId: 'eye.right'
      },
      gaze: 'centered',
      palette: 'high-contrast',
      materialIds: ['eye']
    }],
    exceptions: [{
      component: 'nasal',
      basis: 'observed',
      referenceIds: ['reference.design'],
      rationale: 'The referenced form explicitly has no nasal component.'
    }, {
      component: 'oral',
      basis: 'observed',
      referenceIds: ['reference.design'],
      rationale: 'The referenced form explicitly has no oral component.'
    }]
  },
  specialists: [],
  claims: [{
    authority: {
      id: 'archetype.composable-form',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    },
    criterionId: 'criterion.structure-graph',
    basis: 'observed',
    referenceIds: ['reference.design'],
    rationale: 'The reference declares the complete paired structural graph.'
  }],
  slots: [{
    slotId: 'core',
    structuralRole: 'core',
    qualityStage: 'silhouette',
    partIds: ['core'],
    parentSlotIds: [],
    spatialRelations: [],
    facing: null,
    symmetry: { kind: 'centered' },
    support: { kind: 'none' },
    span: { kind: 'none' }
  }, foot('left'), foot('right'), wing('left'), wing('right'), {
    slotId: 'face.host',
    structuralRole: 'focal-frame',
    qualityStage: 'structure',
    partIds: ['face.host'],
    parentSlotIds: ['core'],
    spatialRelations: ['front'],
    facing: 'forward',
    symmetry: { kind: 'centered' },
    support: { kind: 'none' },
    span: { kind: 'none' }
  }, ...(['left', 'right'] as const).map((side) => ({
    slotId: `eye.${side}`,
    structuralRole: 'focal-frame' as const,
    qualityStage: 'structure' as const,
    partIds: [`eye.${side}`],
    parentSlotIds: ['face.host'],
    spatialRelations: [side],
    facing: 'forward' as const,
    symmetry: { kind: 'paired' as const, pairId: 'pair.eyes' },
    support: { kind: 'none' as const },
    span: { kind: 'none' as const }
  }))],
  coverage: [],
  bindings: []
};

const valid = createAuthoringProfile(document, selection);
assert.equal(
  valid.ok,
  true,
  valid.ok ? '' : valid.issues.map((issue) => issue.message).join('; ')
);

const upSurfaceIntent = normalizeProjectIntent({
  ...normalized.intent,
  semanticContract: {
    ...normalized.intent.semanticContract,
    supportedSurfaces: [{
      id: 'wing.primary',
      role: 'wing',
      configuration: 'paired',
      extension: 'up'
    }]
  }
});
assert.equal(upSurfaceIntent.ok, true);
if (!upSurfaceIntent.ok) throw new Error(upSurfaceIntent.issues[0]?.message);
const upSurfaceDocument: ProjectDocument = {
  ...document,
  intent: upSurfaceIntent.intent
};
const missingUpExtension = createAuthoringProfile(
  upSurfaceDocument,
  selection
);
assert.equal(missingUpExtension.ok, false);
if (!missingUpExtension.ok) {
  assert.ok(missingUpExtension.issues.some((issue) =>
    issue.message.includes('sealed "up" extension')
  ));
}

const pairedUp = createAuthoringProfile(upSurfaceDocument, {
  ...selection,
  slots: selection.slots.map((slot) =>
    slot.slotId.startsWith('wing.')
      ? {
          ...slot,
          spatialRelations: [
            ...slot.spatialRelations,
            'above' as const
          ]
        }
      : slot
  )
});
assert.equal(
  pairedUp.ok,
  true,
  pairedUp.ok
    ? ''
    : pairedUp.issues.map((issue) => issue.message).join('; ')
);

const singleUpIntent = normalizeProjectIntent({
  ...normalized.intent,
  semanticContract: {
    ...normalized.intent.semanticContract,
    supportedSurfaces: [{
      id: 'wing.primary',
      role: 'wing',
      configuration: 'single',
      extension: 'up'
    }]
  }
});
assert.equal(singleUpIntent.ok, true);
if (!singleUpIntent.ok) throw new Error(singleUpIntent.issues[0]?.message);
const sourceWing = selection.slots.find((slot) =>
  slot.slotId === 'wing.left'
);
if (!sourceWing) throw new Error('Expected source wing slot.');
const centeredUpWing: AuthoringSlotAssignment = {
  ...sourceWing,
  slotId: 'wing.center',
  spatialRelations: ['above'],
  symmetry: { kind: 'centered' }
};
const singleUp = createAuthoringProfile({
  ...document,
  intent: singleUpIntent.intent
}, {
  ...selection,
  slots: [
    ...selection.slots.filter((slot) => !slot.slotId.startsWith('wing.')),
    centeredUpWing
  ]
});
assert.equal(
  singleUp.ok,
  true,
  singleUp.ok ? '' : singleUp.issues.map((issue) => issue.message).join('; ')
);

const genericWingPlates = createAuthoringProfile(document, {
  ...selection,
  slots: selection.slots.map((slot) =>
    slot.slotId.startsWith('wing.')
      ? { ...slot, structuralRole: 'accent', span: { kind: 'none' } }
      : slot
  )
});
assert.equal(genericWingPlates.ok, false);
if (!genericWingPlates.ok) {
  assert.ok(genericWingPlates.issues.some((issue) =>
    issue.message.includes('Paired wing obligation')
  ));
}

const undeclaredWing = createAuthoringProfile({
  ...document,
  intent: {
    ...normalized.intent,
    semanticContract: {
      ...normalized.intent.semanticContract,
      supportedSurfaces: []
    }
  }
}, selection);
assert.equal(undeclaredWing.ok, false);
if (!undeclaredWing.ok) {
  assert.ok(undeclaredWing.issues.some((issue) =>
    issue.message.includes('undeclared obligation')
  ));
}

const noFace = createAuthoringProfile(document, {
  ...selection,
  faceMode: 'none',
  face: null,
  slots: selection.slots.map((slot) =>
    slot.slotId.startsWith('eye.')
      ? { ...slot, structuralRole: 'accent' }
      : slot
  )
});
assert.equal(noFace.ok, false);
if (!noFace.ok) {
  assert.ok(noFace.issues.some((issue) =>
    issue.message.includes('Full semantic face authority')
  ));
}

const unauditedAbsentNasal = createAuthoringProfile(document, {
  ...selection,
  face: selection.face && {
    ...selection.face,
    exceptions: selection.face.exceptions.filter((entry) =>
      entry.component !== 'nasal'
    )
  }
});
assert.equal(unauditedAbsentNasal.ok, false);
if (!unauditedAbsentNasal.ok) {
  assert.ok(unauditedAbsentNasal.issues.some((issue) =>
    issue.message.includes('sealed nasal state "absent"')
  ));
}

const withFootSupports = (
  update: (slot: AuthoringSlotAssignment) => AuthoringSlotAssignment
): readonly AuthoringSlotAssignment[] => selection.slots.map((slot) =>
  slot.slotId.startsWith('foot.') ? update(slot) : slot
);

const rumpAsBase = createAuthoringProfile(document, {
  ...selection,
  restPose: { kind: 'canonical-neutral', mode: 'supported' },
  slots: withFootSupports((slot) => ({
    ...slot,
    support: {
      kind: 'base',
      contact: 'grounded',
      supportPartIds: slot.partIds
    }
  }))
});
assert.equal(rumpAsBase.ok, false);
if (!rumpAsBase.ok) {
  assert.ok(rumpAsBase.issues.some((issue) =>
    issue.message.includes('Standing-feet authority') ||
    issue.message.includes('contradicts') ||
    issue.message.includes('do not determine')
  ));
}

for (const slots of [
  withFootSupports((slot) => ({
    ...slot,
    support: { kind: 'none' }
  })),
  withFootSupports((slot) => ({
    ...slot,
    support: slot.support.kind === 'foot'
      ? { ...slot.support, contact: 'free' }
      : slot.support
  }))
]) {
  assert.equal(createAuthoringProfile(document, { ...selection, slots }).ok, false);
}
