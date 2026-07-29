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

export const parsePresentRequest = (
  value: unknown
): ParsePresentRequestResult => {
  if (!isRecord(value) || value.kind !== 'animation') {
    return failure('$', 'animation presentation request');
  }
  if (typeof value.clipId !== 'string' || value.clipId.length === 0) {
    return failure('clipId', 'non-empty animation clip ID');
  }
  if (typeof value.playing !== 'boolean') {
    return failure('playing', 'boolean');
  }
  if (
    value.timeSeconds !== undefined &&
    (
      typeof value.timeSeconds !== 'number' ||
      !Number.isFinite(value.timeSeconds) ||
      value.timeSeconds < 0
    )
  ) {
    return failure('timeSeconds', 'finite number greater than or equal to 0');
  }
  return {
    ok: true,
    request: {
      kind: 'animation',
      clipId: value.clipId,
      playing: value.playing,
      ...(value.timeSeconds === undefined
        ? {}
        : { timeSeconds: value.timeSeconds })
    }
  };
};
