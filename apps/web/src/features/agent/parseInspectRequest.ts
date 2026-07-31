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

const unknownProperty = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[]
): string | null =>
  Object.keys(value).find((key) => !allowed.includes(key)) ?? null;

const rejectUnknownProperties = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[]
): ParseInspectRequestFailure | null => {
  const property = unknownProperty(value, allowed);
  return property === null
    ? null
    : failure(property, 'no additional properties');
};

const pagedRequest = (
  value: Readonly<Record<string, unknown>>,
  kind: 'catalog' | 'activity'
): ParseInspectRequestResult => {
  const maximumLimit = kind === 'activity' ? 20 : 100;
  const unknown = rejectUnknownProperties(
    value,
    ['kind', 'cursor', 'limit']
  );
  if (unknown) return unknown;
  if (
    value.cursor !== undefined &&
    typeof value.cursor !== 'string'
  ) {
    return failure('cursor', 'page cursor string');
  }
  if (
    value.limit !== undefined &&
    (
      typeof value.limit !== 'number' ||
      !Number.isInteger(value.limit) ||
      value.limit < 1 ||
      value.limit > maximumLimit
    )
  ) {
    return failure(
      'limit',
      `integer from 1 through ${maximumLimit}`
    );
  }
  return {
    ok: true,
    request: {
      kind,
      ...(value.cursor === undefined
        ? {}
        : { cursor: value.cursor }),
      ...(value.limit === undefined ? {} : { limit: value.limit })
    }
  };
};

export const parseInspectRequest = (
  value: unknown
): ParseInspectRequestResult => {
  if (value === undefined) return { ok: true };
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return failure('$', 'inspect request object');
  }

  switch (value.kind) {
    case 'command': {
      const unknown = rejectUnknownProperties(
        value,
        ['kind', 'name']
      );
      if (unknown) return unknown;
      return typeof value.name === 'string'
        ? {
            ok: true,
            request: {
              kind: value.kind,
              name: value.name
            }
          }
        : failure('name', 'command name');
    }
    case 'parts':
    case 'entity':
    case 'texture':
    case 'clip': {
      const unknown = rejectUnknownProperties(
        value,
        ['kind', 'ids']
      );
      if (unknown) return unknown;
      return isStringArray(value.ids)
        ? {
            ok: true,
            request: {
              kind: value.kind,
              ids: value.ids
            }
          }
        : failure('ids', 'string ID array');
    }
    case 'catalog':
    case 'activity':
      return pagedRequest(value, value.kind);
    case 'target': {
      const unknown = rejectUnknownProperties(value, ['kind']);
      if (unknown) return unknown;
      return {
        ok: true,
        request: {
          kind: value.kind
        }
      };
    }
    case 'finding': {
      const unknown = rejectUnknownProperties(
        value,
        ['kind', 'path']
      );
      if (unknown) return unknown;
      return typeof value.path === 'string'
        ? {
            ok: true,
            request: {
              kind: value.kind,
              path: value.path
            }
          }
        : failure('path', 'finding path');
    }
    default:
      return failure(
        'kind',
        'command, catalog, parts, entity, texture, clip, activity, target, or finding'
      );
  }
};
