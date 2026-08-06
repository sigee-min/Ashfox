import assert from 'node:assert/strict';

import {
  decideProjectWrite
} from '../src/features/workbench/persistence/indexedDbProjectRepository';
import {
  createLocalProjectRecord,
  LOCAL_PROJECT_SCHEMA_VERSION
} from '../src/application/localProjectRecord';
import { createWorkbenchProject } from './fixtures/workbenchProject';
import {
  createVisualReviewReceiptFixture
} from './fixtures/visualReviewReceipt';

const document = createWorkbenchProject();
const candidate = createLocalProjectRecord({
  document,
  assets: {},
  activity: [],
  visualReviews: [],
  savedAt: '2026-07-30T00:00:00.000Z'
});

assert.equal(
  decideProjectWrite(undefined, candidate).status,
  'stored'
);
assert.equal(
  decideProjectWrite(candidate, candidate).status,
  'unchanged'
);
assert.equal(
  decideProjectWrite(
    {
      ...candidate,
      schemaVersion: (LOCAL_PROJECT_SCHEMA_VERSION - 1) as
        typeof LOCAL_PROJECT_SCHEMA_VERSION
    },
    candidate
  ).status,
  'blocked',
  'an incompatible stored project must never be overwritten implicitly'
);
assert.equal(
  decideProjectWrite(
    {
      ...candidate,
      assets: undefined
    } as unknown as typeof candidate,
    candidate
  ).status,
  'blocked',
  'a stored v1 record missing required assets must not be repaired implicitly'
);

assert.equal(
  decideProjectWrite(
    {
      ...candidate,
      visualReviews: undefined
    } as unknown as typeof candidate,
    candidate
  ).status,
  'blocked',
  'a pre-contract record missing its required review ledger is rejected'
);

const review = createVisualReviewReceiptFixture(document, {
  camera: 'front',
  frameNonce: 11
});
const reviewWrite = decideProjectWrite(candidate, {
  ...candidate,
  visualReviews: [review],
  savedAt: '2026-07-30T00:00:01.000Z'
});
assert.equal(reviewWrite.status, 'stored');
assert.deepEqual(
  reviewWrite.current.visualReviews,
  [review],
  'same-revision evidence appends without inventing a document revision'
);
