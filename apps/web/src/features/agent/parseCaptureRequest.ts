import type {
  AgentCaptureRequest,
  CaptureFailure
} from './types';

interface ParseCaptureRequestSuccess {
  ok: true;
  request: AgentCaptureRequest;
}

interface ParseCaptureRequestFailure {
  ok: false;
  error: CaptureFailure['error'];
}

export type ParseCaptureRequestResult =
  | ParseCaptureRequestSuccess
  | ParseCaptureRequestFailure;

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failure = (
  path: string,
  expected: string
): ParseCaptureRequestFailure => ({
  ok: false,
  error: {
    code: 'invalid_request',
    path,
    expected
  }
});

const CAPTURE_KEYS = new Set(['kind', 'clipId']);
const CAPTURE_CLIP_ID_MAX_LENGTH = 128;

export const parseCaptureRequest = (
  value: unknown
): ParseCaptureRequestResult => {
  if (!isRecord(value)) {
    return failure(
      '$',
      '{kind:"result"} | {kind:"animation",clipId?} | {kind:"build"}'
    );
  }

  const unknownProperty = Object.keys(value).find(
    (key) => !CAPTURE_KEYS.has(key)
  );
  if (unknownProperty) {
    return failure(
      unknownProperty,
      'no additional properties'
    );
  }

  if (value.kind === 'result' || value.kind === 'build') {
    if (Object.keys(value).length !== 1) {
      return failure('$', `{kind:"${value.kind}"}`);
    }
    return {
      ok: true,
      request: { kind: value.kind }
    };
  }

  if (value.kind !== 'animation') {
    return failure('kind', 'result | animation | build');
  }
  if (
    value.clipId !== undefined &&
    (
      typeof value.clipId !== 'string' ||
      value.clipId.trim().length === 0 ||
      value.clipId.length > CAPTURE_CLIP_ID_MAX_LENGTH
    )
  ) {
    return failure('clipId', '1-128 character clip ID');
  }

  return {
    ok: true,
    request: {
      kind: 'animation',
      ...(value.clipId === undefined
        ? {}
        : { clipId: value.clipId })
    }
  };
};
