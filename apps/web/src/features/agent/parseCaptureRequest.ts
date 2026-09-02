import type {
  AgentCaptureRequest,
  CaptureFailure
} from './types';

interface ParseCaptureRequestSuccess {
  readonly ok: true;
  readonly request: AgentCaptureRequest;
}

interface ParseCaptureRequestFailure {
  readonly ok: false;
  readonly error: CaptureFailure['error'];
}

export type ParseCaptureRequestResult =
  | ParseCaptureRequestSuccess
  | ParseCaptureRequestFailure;

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseCaptureRequest = (
  value: unknown
): ParseCaptureRequestResult => {
  if (
    !isRecord(value) ||
    Reflect.ownKeys(value).length !== 1 ||
    value.kind !== 'build'
  ) {
    return {
      ok: false,
      error: {
        code: 'invalid_request',
        path: '$',
        expected: '{kind:"build"}'
      }
    };
  }
  return {
    ok: true,
    request: Object.freeze({ kind: 'build' })
  };
};
