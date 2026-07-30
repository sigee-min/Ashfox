import type {
  InspectFailure,
  InspectRequest
} from './types';

interface ParseInspectRequestSuccess {
  ok: true;
  request?: InspectRequest;
}

interface ParseInspectRequestFailure {
  ok: false;
  error: InspectFailure['error'];
}

export type ParseInspectRequestResult =
  | ParseInspectRequestSuccess
  | ParseInspectRequestFailure;

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failure = (
  path: string,
  expected: string
): ParseInspectRequestFailure => ({
  ok: false,
  error: {
    code: 'invalid_request',
    path,
    expected
  }
});

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === 'string');

export const parseInspectRequest = (
  value: unknown
): ParseInspectRequestResult => {
  if (value === undefined) return { ok: true };
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return failure('$', 'inspect request object');
  }

  switch (value.kind) {
    case 'command':
      return typeof value.name === 'string'
        ? {
            ok: true,
            request: {
              kind: value.kind,
              name: value.name
            }
          }
        : failure('name', 'command name');
    case 'parts':
    case 'entity':
    case 'texture':
    case 'clip':
      return isStringArray(value.ids)
        ? {
            ok: true,
            request: {
              kind: value.kind,
              ids: value.ids
            }
          }
        : failure('ids', 'string ID array');
    case 'catalog':
    case 'target':
      return {
        ok: true,
        request: {
          kind: value.kind
        }
      };
    case 'finding':
      return typeof value.path === 'string'
        ? {
            ok: true,
            request: {
              kind: value.kind,
              path: value.path
            }
          }
        : failure('path', 'finding path');
    default:
      return failure(
        'kind',
        'command, catalog, parts, entity, texture, clip, target, or finding'
      );
  }
};
