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

const rejectUnknownProperties = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[]
): ParseInspectRequestFailure | null => {
  const property = Object.keys(value).find(
    (key) => !allowed.includes(key)
  );
  return property === undefined
    ? null
    : failure(property, 'no additional properties');
};

/** The agent can inspect only public command schemas and compiler findings. */
export const parseInspectRequest = (
  value: unknown
): ParseInspectRequestResult => {
  if (value === undefined) return { ok: true };
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return failure('$', 'inspect request object');
  }

  if (value.kind === 'command') {
    const unknown = rejectUnknownProperties(value, ['kind', 'name']);
    if (unknown) return unknown;
    return typeof value.name === 'string'
      ? { ok: true, request: { kind: 'command', name: value.name } }
      : failure('name', 'command name');
  }

  if (value.kind === 'finding') {
    const unknown = rejectUnknownProperties(value, ['kind', 'path']);
    if (unknown) return unknown;
    return typeof value.path === 'string'
      ? { ok: true, request: { kind: 'finding', path: value.path } }
      : failure('path', 'finding path');
  }

  return failure('kind', 'command or finding');
};
