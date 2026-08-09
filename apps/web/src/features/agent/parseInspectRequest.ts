import type {
  InspectFailure,
  InspectRequest
} from './types';
import { INTENT_PROGRAM_SOURCE_MAX_LENGTH } from '@ashfox/engine-core';

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

export const INTENT_PROGRAM_INSPECT_SOURCE_MAX_LENGTH =
  INTENT_PROGRAM_SOURCE_MAX_LENGTH;

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

  if (value.kind === 'intent-program') {
    const unknown = rejectUnknownProperties(value, ['kind', 'source']);
    if (unknown) return unknown;
    if (typeof value.source !== 'string') {
      return failure('source', 'Intent Program source');
    }
    return value.source.length <= INTENT_PROGRAM_INSPECT_SOURCE_MAX_LENGTH
      ? {
          ok: true,
          request: { kind: 'intent-program', source: value.source }
        }
      : failure(
          'source',
          `source length <= ${INTENT_PROGRAM_INSPECT_SOURCE_MAX_LENGTH} characters`
        );
  }

  return failure('kind', 'command, finding, or intent-program');
};
