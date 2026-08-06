import assert from 'node:assert/strict';

import {
  deliveryVisualReviewsForRevision,
  mergeVisualReviewLedgers,
  recordVisualReview,
  visualReviewsForRevision,
  type VisualReviewReceipt
} from '../src/application/visualReviewReceipt';
import { createWorkbenchProject } from './fixtures/workbenchProject';
import {
  createVisualReviewReceiptFixture
} from './fixtures/visualReviewReceipt';

const document = createWorkbenchProject();
const receipt = (
  revision: string,
  camera: VisualReviewReceipt['observation']['data']['camera'],
  frameNonce: number
): VisualReviewReceipt => createVisualReviewReceiptFixture(document, {
  revision,
  camera,
  frameNonce
});

let reviews: readonly VisualReviewReceipt[] = [];
reviews = recordVisualReview(
  reviews,
  receipt('local-0001', 'front', 1)
);
reviews = recordVisualReview(
  reviews,
  receipt('local-0001', 'side', 2)
);
assert.equal(reviews.length, 2);

reviews = recordVisualReview(
  reviews,
  receipt('local-0001', 'front', 3)
);
assert.equal(reviews.length, 2);
assert.equal(
  reviews.find(
    (review) => review.observation.data.camera === 'front'
  )?.observation.data.frameNonce,
  3,
  'a later observation replaces only the same review slot'
);

assert.equal(
  visualReviewsForRevision(
    reviews,
    document.id,
    'local-0002'
  ).length,
  0
);

reviews = recordVisualReview(
  reviews,
  createVisualReviewReceiptFixture(document, {
    revision: 'local-0001',
    camera: 'side',
    frameNonce: 5,
    verdict: 'rejected',
    issues: ['connection']
  })
);
assert.equal(
  reviews.find(
    (review) => review.observation.data.camera === 'side'
  )?.decision.verdict,
  'rejected'
);

reviews = recordVisualReview(
  reviews,
  receipt('local-0002', 'top', 4)
);
assert.deepEqual(
  visualReviewsForRevision(
    reviews,
    document.id,
    'local-0002'
  ).map((review) => review.observation.data.camera),
  ['top']
);
assert.equal(
  visualReviewsForRevision(
    reviews,
    document.id,
    'local-0001'
  ).length,
  0,
  'recording a new revision replaces the active ledger'
);

reviews = recordVisualReview(
  reviews,
  createVisualReviewReceiptFixture(document, {
    revision: 'local-0002',
    purpose: 'preview',
    milestone: 'archetype',
    camera: 'front',
    frameNonce: 6
  })
);
assert.equal(
  visualReviewsForRevision(
    reviews,
    document.id,
    'local-0002'
  ).length,
  2,
  'milestone evidence remains revision-bound and queryable'
);
assert.deepEqual(
  deliveryVisualReviewsForRevision(
    reviews,
    document.id,
    'local-0002'
  ).map((review) => review.observation.data.camera),
  ['top'],
  'milestone evidence must not enter the delivery ledger'
);

const concurrent = mergeVisualReviewLedgers(
  [receipt('local-0002', 'front', 7)],
  [receipt('local-0002', 'side', 8)]
);
assert.deepEqual(
  concurrent.map((review) => review.observation.data.camera).sort(),
  ['front', 'side'],
  'same-revision storage writes append distinct evidence slots'
);

const tiedTimestamp = '2026-08-06T00:00:01.000Z';
const tieResolved = recordVisualReview(
  [createVisualReviewReceiptFixture(document, {
    revision: 'local-0002',
    camera: 'front',
    frameNonce: 10,
    recordedAt: tiedTimestamp
  })],
  createVisualReviewReceiptFixture(document, {
    revision: 'local-0002',
    camera: 'front',
    frameNonce: 11,
    recordedAt: tiedTimestamp
  })
);
assert.equal(
  tieResolved[0].observation.data.frameNonce,
  11,
  'frame sequence deterministically breaks equal recordedAt ties'
);
