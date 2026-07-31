import assert from 'node:assert/strict';

import {
  recordVisualReview,
  visualReviewsForRevision,
  type VisualReviewReceipt
} from '../src/features/agent/presentationReview';

const receipt = (
  revision: string,
  camera: VisualReviewReceipt['camera'],
  frameNonce: number
): VisualReviewReceipt => ({
  projectId: 'project-test',
  revision,
  mode: 'frame',
  camera,
  clipId: null,
  observedTimeSeconds: 0,
  completedCycles: 0,
  frameNonce,
  verdict: 'accepted',
  issues: []
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
  reviews.find((review) => review.camera === 'front')?.frameNonce,
  3
);

assert.equal(
  visualReviewsForRevision(
    reviews,
    'project-test',
    'local-0002'
  ).length,
  0
);

reviews = recordVisualReview(reviews, {
  ...receipt('local-0001', 'side', 5),
  verdict: 'rejected',
  issues: ['connection']
});
assert.equal(
  reviews.find((review) => review.camera === 'side')?.verdict,
  'rejected'
);

reviews = recordVisualReview(
  reviews,
  receipt('local-0002', 'top', 4)
);
assert.deepEqual(
  visualReviewsForRevision(
    reviews,
    'project-test',
    'local-0002'
  ).map((review) => review.camera),
  ['top']
);
assert.equal(
  visualReviewsForRevision(
    reviews,
    'project-test',
    'local-0001'
  ).length,
  0
);
