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
  'kind',
  'mode',
  'camera',
  'clipId',
  'timeSeconds'
]);

export const parsePresentRequest = (
  value: unknown
): ParsePresentRequestResult => {
  if (!isRecord(value) || value.kind !== 'view') {
    return failure('$', 'deterministic view presentation request');
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
  if (value.mode !== 'frame' && value.mode !== 'cycle') {
    return failure('mode', 'frame or cycle');
  }
  if (
    value.camera !== 'perspective' &&
    value.camera !== 'front' &&
    value.camera !== 'side' &&
    value.camera !== 'top'
  ) {
    return failure(
      'camera',
      'perspective, front, side, or top camera'
    );
  }
  if (
    value.clipId !== null &&
    (
      typeof value.clipId !== 'string' ||
      value.clipId.length === 0
    )
  ) {
    return failure('clipId', 'null or a non-empty animation clip ID');
  }
  if (
    (
      typeof value.timeSeconds !== 'number' ||
      !Number.isFinite(value.timeSeconds) ||
      value.timeSeconds < 0
    )
  ) {
    return failure('timeSeconds', 'finite number greater than or equal to 0');
  }
  if (value.mode === 'cycle' && value.clipId === null) {
    return failure(
      'clipId',
      'a non-empty animation clip ID in cycle mode'
    );
  }
  if (value.mode === 'cycle' && value.timeSeconds !== 0) {
    return failure(
      'timeSeconds',
      '0 in cycle mode'
    );
  }
  if (value.clipId === null && value.timeSeconds !== 0) {
    return failure(
      'timeSeconds',
      '0 when clipId is null'
    );
  }
  return {
    ok: true,
    request: {
      kind: 'view',
      mode: value.mode,
      camera: value.camera,
      clipId: value.clipId,
      timeSeconds: value.timeSeconds
    }
  };
};
