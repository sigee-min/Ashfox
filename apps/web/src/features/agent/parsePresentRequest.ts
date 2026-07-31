import type {
  PresentFailure,
  PresentRequest
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
  'review'
]);

export const parsePresentRequest = (
  value: unknown
): ParsePresentRequestResult => {
  if (!isRecord(value)) {
    return failure('$', '{review:"next"}');
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
  if (value.review !== 'next') {
    return failure('review', 'next');
  }
  return {
    ok: true,
    request: {
      review: 'next'
    }
  };
};
