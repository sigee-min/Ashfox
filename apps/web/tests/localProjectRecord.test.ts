import assert from 'node:assert/strict';

import {
  compareProjectRevisions,
  createLocalProjectRecord,
  isValidLocalProjectRecord,
  isLocalProjectRevision,
  LOCAL_PROJECT_SCHEMA_VERSION,
  localProjectRevisionForSerial,
  parseLocalProjectRecord,
  projectRevisionSerial
} from '../src/application/localProjectRecord';
import { createWorkbenchProject } from './fixtures/workbenchProject';
import { createCommandReceipt } from '../src/application/createCommandReceipt';
import {
  createVisualReviewReceiptFixture
} from './fixtures/visualReviewReceipt';

assert.equal(isLocalProjectRevision('local-0012'), true);
assert.equal(isLocalProjectRevision('source-revision'), false);
assert.equal(projectRevisionSerial('local-0012'), 12);
assert.equal(localProjectRevisionForSerial(12), 'local-0012');
assert.ok(compareProjectRevisions('local-0012', 'local-0011') > 0);
assert.ok(compareProjectRevisions('local-0001', 'source-revision') > 0);
assert.ok(compareProjectRevisions('source-revision', 'local-0001') < 0);

const document = createWorkbenchProject();
const visualReview = createVisualReviewReceiptFixture(document, {
  camera: 'front',
  frameNonce: 7
});
const sideVisualReview = createVisualReviewReceiptFixture(document, {
  camera: 'side',
  frameNonce: 8
});
const current = createLocalProjectRecord({
  document,
  assets: {},
  activity: [],
  visualReviews: [visualReview],
  savedAt: '2026-07-30T00:00:00.000Z'
});
assert.equal(
  isValidLocalProjectRecord(current, document.id),
  true
);
assert.equal(
  isValidLocalProjectRecord(
    {
      ...current,
      schemaVersion: (LOCAL_PROJECT_SCHEMA_VERSION - 1) as
        typeof LOCAL_PROJECT_SCHEMA_VERSION
    },
    document.id
  ),
  false,
  'incompatible local records must never enter the active session'
);
assert.equal(
  isValidLocalProjectRecord(
    { ...current, obsoleteMarker: true } as typeof current,
    document.id
  ),
  false,
  'the v1 local record is a closed single-authority schema'
);

const {
  visualReviews: _removedVisualReviews,
  ...oldRecord
} = current;
assert.equal(
  isValidLocalProjectRecord(oldRecord, document.id),
  false,
  'pre-contract records missing the required visualReviews field are rejected'
);

assert.equal(
  isValidLocalProjectRecord(
    {
      ...current,
      visualReviews: [{
        ...visualReview,
        unknownEvidenceField: true
      }]
    },
    document.id
  ),
  false,
  'unknown receipt fields are rejected by the closed v1 schema'
);

assert.equal(
  isValidLocalProjectRecord(
    {
      ...current,
      visualReviews: [sideVisualReview, visualReview]
    },
    document.id
  ),
  false,
  'a ledger must use canonical evidence-key ordering'
);
assert.equal(
  isValidLocalProjectRecord(
    {
      ...current,
      visualReviews: [visualReview, visualReview]
    },
    document.id
  ),
  false,
  'a ledger cannot contain duplicate evidence keys'
);

const tamperedMatrix = structuredClone(visualReview);
(tamperedMatrix.observation.data.cameraMatrix as number[])[0] = 2;
assert.equal(
  isValidLocalProjectRecord(
    { ...current, visualReviews: [tamperedMatrix] },
    document.id
  ),
  false,
  'tampered observation evidence fails its canonical fingerprint'
);

const tamperedPixels = structuredClone(visualReview);
tamperedPixels.observation.data.frameEvidence.pixelHash =
  `sha256:${'f'.repeat(64)}`;
assert.equal(
  isValidLocalProjectRecord(
    { ...current, visualReviews: [tamperedPixels] },
    document.id
  ),
  false,
  'tampered rendered-frame pixels fail the receipt fingerprint'
);

assert.equal(
  isValidLocalProjectRecord(
    {
      ...current,
      document: {
        ...current.document,
        name: `${current.document.name} tampered`
      }
    },
    document.id
  ),
  false,
  'the fingerprint binds the full canonical document snapshot'
);

const reloaded = parseLocalProjectRecord(
  structuredClone(current),
  document.id
);
assert.deepEqual(
  reloaded.visualReviews,
  current.visualReviews,
  'a strict storage decode preserves review evidence across reload'
);

const activityReceipt = createCommandReceipt({
  commandId: 'command-local-record-test',
  projectId: document.id,
  source: 'agent',
  actorId: 'test-agent',
  summary: 'Test persisted activity',
  beforeRevision: 'local-0000',
  revision: document.revision,
  completedAt: '2026-07-29T23:59:59.000Z',
  effects: {
    createdEntityIds: [],
    changedEntityIds: [],
    removedEntityIds: [],
    invalidated: []
  },
  findings: []
});
const withActivity = {
  ...current,
  activity: [activityReceipt]
};
assert.equal(
  isValidLocalProjectRecord(withActivity, document.id),
  true,
  'the current closed command receipt ledger remains valid'
);
assert.equal(
  isValidLocalProjectRecord(
    {
      ...withActivity,
      activity: [{ ...activityReceipt, unknownField: true }]
    },
    document.id
  ),
  false,
  'unknown command receipt fields are rejected'
);
const {
  actorId: _removedActorId,
  ...missingActorReceipt
} = activityReceipt;
assert.equal(
  isValidLocalProjectRecord(
    { ...withActivity, activity: [missingActorReceipt] },
    document.id
  ),
  false,
  'missing command receipt fields are rejected'
);
assert.equal(
  isValidLocalProjectRecord(
    {
      ...withActivity,
      activity: [{ ...activityReceipt, schemaVersion: 2 }]
    },
    document.id
  ),
  false,
  'non-v1 command receipts are rejected'
);
assert.equal(
  isValidLocalProjectRecord(
    {
      ...withActivity,
      activity: [{
        ...activityReceipt,
        projectId: 'project-other'
      }]
    },
    document.id
  ),
  false,
  'activity receipts must belong to the enclosing project'
);
