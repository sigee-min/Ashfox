import type {
  PresentResult,
  PresentSuccess,
  VisualReviewDecisionRequest
} from '../../agent/types';

export type PresentationObservationResolution =
  | {
      ok: true;
      observation: PresentSuccess;
    }
  | {
      ok: false;
      clear: boolean;
      result: PresentResult;
    };

export const resolvePresentationObservation = (
  observations: ReadonlyMap<number, PresentSuccess>,
  frameNonce: number,
  revision: string
): PresentationObservationResolution => {
  const observation = observations.get(frameNonce);
  if (!observation) {
    return {
      ok: false,
      clear: false,
      result: {
        ok: false,
        revision,
        error: {
          code: 'not_found',
          path: 'frameNonce',
          expected:
            'the most recently observed pending review frame'
        }
      }
    };
  }
  if (observation.revision !== revision) {
    return {
      ok: false,
      clear: true,
      result: {
        ok: false,
        revision,
        error: {
          code: 'stale_revision',
          path: 'revision',
          expected: observation.revision
        }
      }
    };
  }
  return { ok: true, observation };
};

const sameIds = (
  expected: readonly string[],
  received: readonly string[]
): boolean =>
  expected.length === received.length &&
  expected.every((id) => received.includes(id));

const checkIdExpectation = (
  ids: readonly string[]
): string =>
  ids.length === 0
    ? 'an empty array because this frame returned no review checks'
    : `exactly the returned review check IDs: ${ids.join(', ')}`;

export const reviewPresentationObservation = (
  observation: PresentSuccess,
  request: VisualReviewDecisionRequest
): PresentResult => {
  const observedCheckIds = observation.data.reviewChecks.map(
    (check) => check.id
  );
  if (
    request.review === 'accept' &&
    !sameIds(observedCheckIds, request.checkIds)
  ) {
    return {
      ok: false,
      revision: observation.revision,
      error: {
        code: 'invalid_request',
        path: 'checkIds',
        expected: checkIdExpectation(observedCheckIds)
      }
    };
  }

  const failedCheckIds = request.review === 'reject'
    ? request.failedCheckIds
    : [];
  const checksById = new Map(
    observation.data.reviewChecks.map((check) => [check.id, check])
  );
  if (
    request.review === 'reject' &&
    observedCheckIds.length > 0 &&
    failedCheckIds.length === 0
  ) {
    return {
      ok: false,
      revision: observation.revision,
      error: {
        code: 'invalid_request',
        path: 'failedCheckIds',
        expected:
          'at least one returned review check ID for this rejected frame'
      }
    };
  }
  const unknownFailedCheckId = failedCheckIds.find(
    (id) => !checksById.has(id)
  );
  if (unknownFailedCheckId) {
    return {
      ok: false,
      revision: observation.revision,
      error: {
        code: 'invalid_request',
        path: 'failedCheckIds',
        expected:
          'only review check IDs returned with the observed frame'
      }
    };
  }
  if (request.review === 'reject') {
    const mismatchedIssueId = failedCheckIds.find((id) => {
      const check = checksById.get(id);
      return check !== undefined &&
        !request.issues.includes(check.issue);
    });
    if (mismatchedIssueId) {
      return {
        ok: false,
        revision: observation.revision,
        error: {
          code: 'invalid_request',
          path: 'failedCheckIds',
          expected:
            'each failed review check issue to appear in issues'
        }
      };
    }
  }

  const acknowledgedCheckIds = request.review === 'accept'
    ? [...observedCheckIds]
    : observedCheckIds.filter((id) => failedCheckIds.includes(id));
  const reviewed: PresentSuccess = {
    ...observation,
    data: {
      ...observation.data,
      review: request.review,
      verdict:
        request.review === 'accept'
          ? 'accepted'
          : 'rejected',
      issues:
        request.review === 'reject'
          ? request.issues
          : [],
      acknowledgedCheckIds,
      failedCheckIds: request.review === 'reject'
        ? acknowledgedCheckIds
        : []
    }
  };
  return reviewed;
};
