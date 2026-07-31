import type {
  PresentFailure,
  PresentRequest,
  VisualReviewIssue
} from './types';

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

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
  'frameNonce',
  'issues'
]);

const REVIEW_ISSUES =
  new Set<VisualReviewIssue>([
    'silhouette',
    'proportion',
    'connection',
    'clipping',
    'focal_detail',
    'material',
    'pivot',
    'motion',
    'other'
  ]);

export const parsePresentRequest = (
  value: unknown
): ParsePresentRequestResult => {
  if (!isRecord(value)) {
    return failure(
      '$',
      '{review:"next"} | {review:"accept",frameNonce} | ' +
      '{review:"reject",frameNonce,issues}'
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
  if (
    value.review !== 'accept' &&
    value.review !== 'reject'
  ) {
    return failure('review', 'next | accept | reject');
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
      Object.keys(value).length !== 2 ||
      'issues' in value
    ) {
      return failure(
        '$',
        '{review:"accept",frameNonce}'
      );
    }
    return {
      ok: true,
      request: {
        review: 'accept',
        frameNonce: value.frameNonce
      }
    };
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
  return {
    ok: true,
    request: {
      review: 'reject',
      frameNonce: value.frameNonce,
      issues: [
        ...value.issues
      ] as readonly VisualReviewIssue[]
    }
  };
};
