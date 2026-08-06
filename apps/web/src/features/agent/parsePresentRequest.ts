import {
  VISUAL_REVIEW_CAMERAS,
  VISUAL_REVIEW_ISSUES,
  VISUAL_REVIEW_MILESTONES,
  type PresentFailure,
  type PresentRequest,
  type VisualReviewCamera,
  type VisualReviewMilestone,
  type VisualReviewIssue
} from './types';
import {
  isClosedContractRecord
} from '@ashfox/internal-contracts';

interface ParsePresentRequestSuccess {
  ok: true;
  request: PresentRequest;
}

interface ParsePresentRequestFailure {
  ok: false;
  error: PresentFailure['error'];
}

export type ParsePresentRequestResult =
  | ParsePresentRequestSuccess
  | ParsePresentRequestFailure;

const failure = (
  path: string,
  expected: string
): ParsePresentRequestFailure => ({
  ok: false,
  error: {
    code: 'invalid_request',
    path,
    expected
  }
});

const PRESENT_KEYS = new Set([
  'review',
  'milestone',
  'camera',
  'frameNonce',
  'issues',
  'checkIds',
  'failedCheckIds'
]);

const REVIEW_MILESTONES = new Set<VisualReviewMilestone>([
  ...VISUAL_REVIEW_MILESTONES
]);

const REVIEW_CAMERAS = new Set<VisualReviewCamera>([
  ...VISUAL_REVIEW_CAMERAS
]);

const REVIEW_ISSUES =
  new Set<VisualReviewIssue>(VISUAL_REVIEW_ISSUES);

const CHECK_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_CHECK_IDS = 64;

const validCheckIds = (
  value: unknown
): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= MAX_CHECK_IDS &&
  value.every(
    (id) =>
      typeof id === 'string' &&
      id.length <= 128 &&
      CHECK_ID_PATTERN.test(id)
  ) &&
  new Set(value).size === value.length;

export const parsePresentRequest = (
  value: unknown
): ParsePresentRequestResult => {
  if (!isClosedContractRecord(value)) {
    return failure(
      '$',
      '{review:"next"} | {review:"preview",milestone?,camera?} | ' +
      '{review:"accept",frameNonce,checkIds} | ' +
      '{review:"reject",frameNonce,issues,failedCheckIds}'
    );
  }
  const unknownProperty = Object.keys(value).find(
    (key) => !PRESENT_KEYS.has(key)
  );
  if (unknownProperty) {
    return failure(
      unknownProperty,
      'no additional properties'
    );
  }
  if (value.review === 'next') {
    if (Object.keys(value).length !== 1) {
      return failure('$', '{review:"next"}');
    }
    return {
      ok: true,
      request: {
        review: 'next'
      }
    };
  }
  if (value.review === 'preview') {
    const invalidPreviewProperty = Object.keys(value).find(
      (key) =>
        key !== 'review' &&
        key !== 'milestone' &&
        key !== 'camera'
    );
    if (invalidPreviewProperty) {
      return failure(
        invalidPreviewProperty,
        'no additional properties for preview'
      );
    }
    if (
      'milestone' in value &&
      (
        typeof value.milestone !== 'string' ||
        !REVIEW_MILESTONES.has(
          value.milestone as VisualReviewMilestone
        )
      )
    ) {
      return failure(
        'milestone',
        'archetype | specialists'
      );
    }
    if (
      'camera' in value &&
      (
        typeof value.camera !== 'string' ||
        !REVIEW_CAMERAS.has(value.camera as VisualReviewCamera)
      )
    ) {
      return failure(
        'camera',
        'perspective | native | front | side | top'
      );
    }
    return {
      ok: true,
      request: {
        review: 'preview',
        ...('milestone' in value
          ? { milestone: value.milestone as VisualReviewMilestone }
          : {}),
        ...('camera' in value
          ? { camera: value.camera as VisualReviewCamera }
          : {})
      }
    };
  }
  if (
    value.review !== 'accept' &&
    value.review !== 'reject'
  ) {
    return failure('review', 'next | preview | accept | reject');
  }
  if (
    typeof value.frameNonce !== 'number' ||
    !Number.isSafeInteger(value.frameNonce) ||
    value.frameNonce <= 0
  ) {
    return failure('frameNonce', 'positive safe integer');
  }
  if (value.review === 'accept') {
    if (
      Object.keys(value).length !== 3 ||
      !('checkIds' in value)
    ) {
      return failure(
        '$',
        '{review:"accept",frameNonce,checkIds}'
      );
    }
    if (!validCheckIds(value.checkIds)) {
      return failure(
        'checkIds',
        '0-64 unique canonical review check IDs'
      );
    }
    return {
      ok: true,
      request: {
        review: 'accept',
        frameNonce: value.frameNonce,
        checkIds: [...value.checkIds]
      }
    };
  }
  if (Object.keys(value).length !== 4) {
    return failure(
      '$',
      '{review:"reject",frameNonce,issues,failedCheckIds}'
    );
  }
  if (
    !Array.isArray(value.issues) ||
    value.issues.length === 0 ||
    value.issues.length > REVIEW_ISSUES.size ||
    value.issues.some(
      (issue) =>
        typeof issue !== 'string' ||
        !REVIEW_ISSUES.has(issue as VisualReviewIssue)
    ) ||
    new Set(value.issues).size !== value.issues.length
  ) {
    return failure(
      'issues',
      '1-9 unique visual review issue codes'
    );
  }
  if (!validCheckIds(value.failedCheckIds)) {
    return failure(
      'failedCheckIds',
      '0-64 unique canonical review check IDs'
    );
  }
  return {
    ok: true,
    request: {
      review: 'reject',
      frameNonce: value.frameNonce,
      issues: [
        ...value.issues
      ] as readonly VisualReviewIssue[],
      failedCheckIds: [...value.failedCheckIds]
    }
  };
};
