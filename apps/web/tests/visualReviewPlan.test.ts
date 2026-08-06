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
} from '../src/application/visualReviewReceipt';
import {
  createVisualReviewReceiptFixture
} from './fixtures/visualReviewReceipt';

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
): VisualReviewReceipt => createVisualReviewReceiptFixture(document, {
  mode: review.mode,
  camera: review.camera,
  clipId: review.clipId,
  completedCycles,
  frameNonce: 1
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
assert.deepEqual(
  remainingVisualReviews(
    document,
    readiness,
    [createVisualReviewReceiptFixture(document, {
      purpose: 'preview',
      milestone: 'archetype',
      mode: required[0].mode,
      camera: required[0].camera,
      clipId: required[0].clipId
    })]
  ).map(visualReviewKey),
  required.map(visualReviewKey),
  'an accepted milestone preview must not satisfy delivery review'
);

assert.ok(
  remainingVisualReviews(
    document,
    readiness,
    [
      ...required.slice(0, -1).map((review) => receipt(review)),
      {
        ...receipt(required.at(-1)!),
        observation: {
          ...receipt(required.at(-1)!).observation,
          data: {
            ...receipt(required.at(-1)!).observation.data,
            completedCycles: 0
          }
        }
      }
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
    [createVisualReviewReceiptFixture(document, {
      mode: required[0].mode,
      camera: required[0].camera,
      clipId: required[0].clipId,
      verdict: 'rejected',
      issues: ['silhouette']
    })]
  )[0],
  required[0],
  'a rendered but rejected view must remain incomplete'
);
