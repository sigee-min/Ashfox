import assert from 'node:assert/strict';

import {
  evaluateProductionReadiness,
  formatProfileForExport
} from '@ashfox/engine-core';

import {
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import {
  nextVisualReview,
  remainingVisualReviews,
  requiredVisualReviews,
  visualReviewKey
} from '../src/features/agent/visualReviewPlan';
import type {
  VisualReviewReceipt
} from '../src/features/agent/presentationReview';

const document = createGltfProject();
const required = requiredVisualReviews(document);

assert.deepEqual(
  required.map(visualReviewKey),
  [
    'frame:perspective',
    'frame:native',
    'frame:front',
    'frame:side',
    'frame:top',
    'cycle:perspective:clip-idle'
  ]
);

const javaBlockProfile = formatProfileForExport(
  'java_block',
  '26.2',
  'ashfox',
  'ashfox_crate'
);
assert.ok(javaBlockProfile);
const staticTargetDocument = {
  ...document,
  formatProfile: javaBlockProfile
};
assert.equal(
  Object.keys(staticTargetDocument.animations).length,
  1,
  'the static delivery profile must not delete canonical clips'
);
assert.deepEqual(
  requiredVisualReviews(staticTargetDocument).map(visualReviewKey),
  [
    'frame:perspective',
    'frame:native',
    'frame:front',
    'frame:side',
    'frame:top'
  ],
  'a static artifact must not require reviews for omitted clip cycles'
);

const receipt = (
  review: (typeof required)[number],
  completedCycles = review.mode === 'cycle' ? 1 : 0
): VisualReviewReceipt => ({
  projectId: document.id,
  revision: document.revision,
  mode: review.mode,
  camera: review.camera,
  clipId: review.clipId,
  observedTimeSeconds: 0,
  completedCycles,
  frameNonce: 1,
  verdict: 'accepted',
  issues: []
});

const readiness = evaluateProductionReadiness(document);
assert.deepEqual(
  visualReviewKey(
    nextVisualReview(document, readiness, [])!
  ),
  'frame:perspective'
);
assert.deepEqual(
  remainingVisualReviews(
    document,
    readiness,
    [receipt(required[0])]
  ).map(visualReviewKey),
  required.slice(1).map(visualReviewKey)
);

assert.ok(
  remainingVisualReviews(
    document,
    readiness,
    [
      ...required.slice(0, -1).map((review) => receipt(review)),
      receipt(required.at(-1)!, 0)
    ]
  ).some((review) =>
    visualReviewKey(review) === 'cycle:perspective:clip-idle'
  ),
  'an incomplete cycle must not satisfy its review'
);

assert.deepEqual(
  remainingVisualReviews(
    document,
    readiness,
    required.map((review) => receipt(review))
  ),
  []
);

assert.deepEqual(
  remainingVisualReviews(
    document,
    readiness,
    [{
      ...receipt(required[0]),
      verdict: 'rejected',
      issues: ['silhouette']
    }]
  )[0],
  required[0],
  'a rendered but rejected view must remain incomplete'
);
