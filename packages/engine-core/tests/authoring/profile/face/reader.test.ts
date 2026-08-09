import assert from 'node:assert/strict';

import { readAuthoringFace } from '../../../../src/authoring/profile/face';
import type { AuthoringProfileIssue } from '../../../../src/authoring/profile/evidence';
import type { AuthoringSlotAssignment } from '../../../../src/authoring/contract';

const slot = (
  slotId: string,
  parentSlotIds: readonly string[],
  structuralRole: AuthoringSlotAssignment['structuralRole'] = 'focal-frame'
): AuthoringSlotAssignment => ({
  slotId,
  structuralRole,
  qualityStage: 'structure',
  partIds: [slotId],
  parentSlotIds,
  spatialRelations: parentSlotIds.length === 0 ? [] : ['front'],
  facing: structuralRole === 'focal-frame' ? 'forward' : null,
  symmetry: { kind: 'centered' },
  support: { kind: 'none' },
  span: { kind: 'none' }
});

const slots: readonly AuthoringSlotAssignment[] = [
  slot('core', [], 'core'),
  slot('face.host', ['core']),
  slot('eye.center', ['face.host']),
  slot('oral', ['face.host']),
  slot('outside', ['core'])
];

const closedContractInput = {
  hostSlotId: 'face.host',
  mouthState: 'closed',
  components: [{
    component: 'eye',
    form: 'eye',
    configuration: { kind: 'single', slotId: 'eye.center' },
    gaze: 'centered',
    palette: 'high-contrast',
    materialIds: ['iris'],
    slotIds: ['eye.center']
  }, {
    component: 'nasal',
    form: 'nose',
    slotIds: ['outside'],
    materialIds: ['nose'],
    gaze: 'centered'
  }, {
    component: 'oral',
    form: 'mouth',
    slotIds: ['oral'],
    materialIds: ['mouth']
  }],
  exceptions: []
};

const before = JSON.stringify({ closedContractInput, slots });
const closedIssues: AuthoringProfileIssue[] = [];
const first = readAuthoringFace(
  closedContractInput,
  'full',
  null,
  slots,
  undefined,
  closedIssues
);
const repeatedIssues: AuthoringProfileIssue[] = [];
const second = readAuthoringFace(
  closedContractInput,
  'full',
  null,
  slots,
  undefined,
  repeatedIssues
);

assert.deepEqual(second, first, 'face reading is deterministic');
assert.deepEqual(repeatedIssues, closedIssues, 'diagnostic order is deterministic');
assert.equal(JSON.stringify({ closedContractInput, slots }), before,
  'face reading does not mutate its contract or slot inputs');
assert.deepEqual(
  closedIssues.map((issue) => issue.path),
  ['face.components[0]', 'face.components[1]'],
  'eye and non-eye closed-contract diagnostics retain source order'
);
assert.deepEqual(
  first?.components.map((component) => component.component),
  ['oral'],
  'only fully read declarations cross the readonly face boundary'
);

const topologyInput = {
  ...closedContractInput,
  components: [{
    component: 'eye',
    form: 'eye',
    configuration: { kind: 'single', slotId: 'outside' },
    gaze: 'centered',
    palette: 'high-contrast',
    materialIds: ['iris']
  }, {
    component: 'nasal',
    form: 'nose',
    slotIds: ['missing'],
    materialIds: ['nose']
  }, closedContractInput.components[2]]
};
const topologyIssues: AuthoringProfileIssue[] = [];
readAuthoringFace(
  topologyInput,
  'full',
  null,
  slots,
  undefined,
  topologyIssues
);
assert.deepEqual(
  topologyIssues.slice(0, 2).map((issue) => issue.path),
  ['face.components[0].configuration', 'face.components[1].slotIds'],
  'eye and non-eye topology failures retain declaration order and paths'
);
