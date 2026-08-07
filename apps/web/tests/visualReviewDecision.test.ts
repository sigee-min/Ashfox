import assert from 'node:assert/strict';

import {
  parsePresentRequest
} from '../src/features/agent/parsePresentRequest';
import {
  visualReviewReceiptFrom
} from '../src/application/visualReviewReceipt';
import {
  presentedReviewChecks
} from '../src/application/visualReviewContract';
import {
  createAuthoringProject,
  createEssentialFullFaceProject
} from './fixtures/authoringProject';
import type {
  PresentSuccess
} from '../src/features/agent/types';
import {
  resolvePresentationObservation,
  reviewPresentationObservation
} from '../src/features/workbench/presentation/visualReviewDecision';

const observation: PresentSuccess = {
  ok: true,
  revision: 'local-0003',
  data: {
    review: 'next',
    purpose: 'delivery',
    milestone: null,
    verdict: 'pending',
    issues: [],
    acknowledgedCheckIds: [],
    failedCheckIds: [],
    frameNonce: 17,
    mode: 'frame',
    camera: 'front',
    cameraMatrix: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ],
    clipId: null,
    playing: false,
    observedTimeSeconds: 0,
    completedCycles: 0,
    previewIssues: [],
    reviewChecks: [{
      id: 'composable-form.focal-read',
      facets: ['face'],
      issue: 'focal_detail',
      instruction: 'Verify that the face reads.',
      authority: {
        id: 'archetype.composable-form',
        version: 1
      },
      authorityType: 'archetype',
      evidence: {
        criteria: [{
          id: 'criterion.structure-graph',
          basis: 'either',
          required: true,
          instruction: 'Ground the body plan.'
        }],
        claims: [{
          criterionId: 'criterion.structure-graph',
          basis: 'observed',
          referenceIds: ['reference.demo'],
          rationale: 'The reference shows the body plan.'
        }]
      }
    }, {
      id: 'composable-form.silhouette-read',
      facets: ['silhouette'],
      issue: 'proportion',
      instruction: 'Verify the forward stance.',
      authority: {
        id: 'archetype.composable-form',
        version: 1
      },
      authorityType: 'archetype',
      evidence: {
        criteria: [{
          id: 'criterion.structure-graph',
          basis: 'either',
          required: true,
          instruction: 'Ground the body plan.'
        }],
        claims: [{
          criterionId: 'criterion.structure-graph',
          basis: 'observed',
          referenceIds: ['reference.demo'],
          rationale: 'The reference shows the body plan.'
        }]
      }
    }]
  }
};

const nativeFullFaceCheckIds = presentedReviewChecks(
  createEssentialFullFaceProject(),
  'native',
  false,
  null,
  null
).map((check) => check.id);
assert.ok(nativeFullFaceCheckIds.includes(
  'composable-form.face-native-read'
));
assert.ok(nativeFullFaceCheckIds.includes(
  'composable-form.face-essential-budget'
));
assert.ok(nativeFullFaceCheckIds.includes(
  'composable-form.face-surface-contrast'
));

const missingObservation = resolvePresentationObservation(
  new Map(),
  17,
  'local-0003'
);
assert.equal(missingObservation.ok, false);
if (!missingObservation.ok) {
  assert.equal(missingObservation.result.ok, false);
  assert.equal(missingObservation.clear, false);
}
const staleObservation = resolvePresentationObservation(
  new Map([[17, observation]]),
  17,
  'local-0004'
);
assert.equal(staleObservation.ok, false);
if (!staleObservation.ok) {
  assert.equal(staleObservation.clear, true);
  assert.equal(staleObservation.result.ok, false);
  if (!staleObservation.result.ok) {
    assert.equal(
      staleObservation.result.error.code,
      'stale_revision'
    );
  }
}

assert.equal(
  parsePresentRequest({
    review: 'accept',
    frameNonce: 17
  }).ok,
  false,
  'acceptance must explicitly supply returned review check IDs'
);
assert.deepEqual(
  parsePresentRequest({
    review: 'preview',
    milestone: 'archetype',
    camera: 'perspective'
  }),
  {
    ok: true,
    request: {
      review: 'preview',
      milestone: 'archetype',
      camera: 'perspective'
    }
  }
);

const incompleteAcceptance = reviewPresentationObservation(
  observation,
  {
    review: 'accept',
    frameNonce: 17,
    checkIds: ['composable-form.focal-read']
  }
);
assert.equal(incompleteAcceptance.ok, false);
if (!incompleteAcceptance.ok) {
  assert.equal(incompleteAcceptance.error.path, 'checkIds');
}

const accepted = reviewPresentationObservation(
  observation,
  {
    review: 'accept',
    frameNonce: 17,
    checkIds: [
      'composable-form.silhouette-read',
      'composable-form.focal-read'
    ]
  }
);
assert.equal(accepted.ok, true);
if (accepted.ok) {
  assert.equal(accepted.data.verdict, 'accepted');
  assert.deepEqual(accepted.data.acknowledgedCheckIds, [
    'composable-form.focal-read',
    'composable-form.silhouette-read'
  ]);
}

const unknownFailure = reviewPresentationObservation(
  observation,
  {
    review: 'reject',
    frameNonce: 17,
    issues: ['focal_detail'],
    failedCheckIds: ['unknown.check']
  }
);
assert.equal(unknownFailure.ok, false);
if (!unknownFailure.ok) {
  assert.equal(unknownFailure.error.path, 'failedCheckIds');
}

const emptyCheckFailure = reviewPresentationObservation(
  observation,
  {
    review: 'reject',
    frameNonce: 17,
    issues: ['other'],
    failedCheckIds: []
  }
);
assert.equal(emptyCheckFailure.ok, false);
if (!emptyCheckFailure.ok) {
  assert.equal(emptyCheckFailure.error.path, 'failedCheckIds');
}

const genericObservation: PresentSuccess = {
  ...observation,
  data: {
    ...observation.data,
    reviewChecks: []
  }
};
assert.equal(
  reviewPresentationObservation(
    genericObservation,
    {
      review: 'reject',
      frameNonce: 17,
      issues: ['other'],
      failedCheckIds: []
    }
  ).ok,
  true,
  'a generic frame without review checks can reject with an empty subset'
);

const mismatchedFailure = reviewPresentationObservation(
  observation,
  {
    review: 'reject',
    frameNonce: 17,
    issues: ['proportion'],
    failedCheckIds: ['composable-form.focal-read']
  }
);
assert.equal(mismatchedFailure.ok, false);

const rejected = reviewPresentationObservation(
  observation,
  {
    review: 'reject',
    frameNonce: 17,
    issues: ['focal_detail'],
    failedCheckIds: ['composable-form.focal-read']
  }
);
assert.equal(rejected.ok, true);
if (rejected.ok) {
  assert.equal(rejected.data.verdict, 'rejected');
  assert.deepEqual(
    rejected.data.failedCheckIds,
    ['composable-form.focal-read']
  );
  const document = createAuthoringProject();
  const semanticObservation: PresentSuccess = {
    ...observation,
    revision: document.revision,
    data: {
      ...observation.data,
      reviewChecks: presentedReviewChecks(
        document,
        'front',
        false,
        null,
        null
      )
    }
  };
  const semanticRejected = reviewPresentationObservation(
    semanticObservation,
    {
      review: 'reject',
      frameNonce: 17,
      issues: ['focal_detail'],
      failedCheckIds: ['composable-form.focal-read']
    }
  );
  assert.equal(semanticRejected.ok, true);
  if (!semanticRejected.ok) throw new Error('Expected semantic rejection.');
  const receipt = visualReviewReceiptFrom(
    document,
    semanticObservation,
    semanticRejected,
    {
      actorId: 'test-agent',
      recordedAt: '2026-08-06T00:00:00.000Z'
    }
  );
  assert.ok(receipt);
  assert.deepEqual(receipt.observation.data.reviewChecks.map(
    (check) => check.id
  ), [
    'composable-form.focal-read',
    'composable-form.track-hero-structure',
    'composable-form.track-hero-material',
    'role-props.role-read'
  ]);
  assert.deepEqual(
    receipt.observation.data.reviewChecks.map((check) => ({
      authority: check.authority.id,
      criteria: check.evidence.criteria.map((criterion) => criterion.id),
      claims: check.evidence.claims.map((claim) => claim.criterionId)
    })),
    [{
      authority: 'archetype.composable-form',
      criteria: ['criterion.structure-graph'],
      claims: ['criterion.structure-graph']
    }, {
      authority: 'archetype.composable-form',
      criteria: ['criterion.structure-graph'],
      claims: ['criterion.structure-graph']
    }, {
      authority: 'archetype.composable-form',
      criteria: ['criterion.structure-graph'],
      claims: ['criterion.structure-graph']
    }, {
      authority: 'specialist.role-props',
      criteria: ['criterion.role-cue'],
      claims: ['criterion.role-cue']
    }],
    'the receipt must retain the authority criteria and claims reviewed'
  );
  assert.deepEqual(
    receipt.decision.acknowledgedCheckIds,
    ['composable-form.focal-read']
  );
  assert.deepEqual(receipt.decision.failedCheckIds, [
    'composable-form.focal-read'
  ]);
  const mismatchedFrame: PresentSuccess = {
    ...semanticRejected,
    data: {
      ...semanticRejected.data,
      camera: 'side'
    }
  };
  assert.equal(
    visualReviewReceiptFrom(
      document,
      semanticObservation,
      mismatchedFrame,
      {
        actorId: 'test-agent',
        recordedAt: '2026-08-06T00:00:00.000Z'
      }
    ),
    null,
    'a decision payload from a different observed frame must be rejected'
  );
  const incompleteObservation: PresentSuccess = {
    ...semanticObservation,
    data: {
      ...semanticObservation.data,
      reviewChecks: semanticObservation.data.reviewChecks.slice(0, 1)
    }
  };
  const incompleteReviewed = reviewPresentationObservation(
    incompleteObservation,
    {
      review: 'reject',
      frameNonce: 17,
      issues: ['focal_detail'],
      failedCheckIds: ['composable-form.focal-read']
    }
  );
  assert.equal(incompleteReviewed.ok, true);
  if (!incompleteReviewed.ok) throw new Error('Expected local decision.');
  assert.equal(
    visualReviewReceiptFrom(
      document,
      incompleteObservation,
      incompleteReviewed,
      {
        actorId: 'test-agent',
        recordedAt: '2026-08-06T00:00:00.000Z'
      }
    ),
    null,
    'a self-consistent but incomplete authority check set is not valid evidence'
  );
  const wrongCriterionObservation = structuredClone(semanticObservation);
  (
    wrongCriterionObservation.data.reviewChecks as {
      evidence: { claims: { criterionId: string }[] };
    }[]
  )[0].evidence.claims[0].criterionId = 'criterion.role-cue';
  const wrongCriterionReviewed = reviewPresentationObservation(
    wrongCriterionObservation,
    {
      review: 'reject',
      frameNonce: 17,
      issues: ['focal_detail'],
      failedCheckIds: ['composable-form.focal-read']
    }
  );
  assert.equal(wrongCriterionReviewed.ok, true);
  if (!wrongCriterionReviewed.ok) throw new Error('Expected local decision.');
  assert.equal(
    visualReviewReceiptFrom(
      document,
      wrongCriterionObservation,
      wrongCriterionReviewed,
      {
        actorId: 'test-agent',
        recordedAt: '2026-08-06T00:00:00.000Z'
      }
    ),
    null,
    'a receipt cannot substitute a criterion claim from another authority'
  );
  (semanticObservation.data.cameraMatrix as number[])[0] = 99;
  (
    semanticObservation.data.reviewChecks as {
      evidence: { criteria: { id: string }[] };
    }[]
  )[0].evidence.criteria[0].id = 'criterion.mutated';
  (semanticObservation.data.reviewChecks as { id: string }[])[0].id =
    'mutated.after.receipt';
  assert.equal(receipt.observation.data.cameraMatrix[0], 1);
  assert.equal(
    receipt.observation.data.reviewChecks[0].id,
    'composable-form.focal-read',
    'the receipt must own a deep snapshot of the raw observation'
  );
  assert.equal(
    receipt.observation.data.reviewChecks[0].evidence.criteria[0].id,
    'criterion.structure-graph',
    'the receipt must deeply snapshot evidence criteria'
  );
}
