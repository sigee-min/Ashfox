import {
  getAgentCommandDefinition,
  type ProjectCommandOperation
} from '@ashfox/engine-core';

interface ParseSuccess {
  ok: true;
  request: {
    operations: readonly ProjectCommandOperation[];
  };
}

interface ParseFailure {
  ok: false;
  error: {
    code: 'invalid_batch';
    path: string;
    expected: string;
  };
}

export type ParseRunRequestResult = ParseSuccess | ParseFailure;

const REQUEST_KEYS = new Set(['operations']);
const OPERATION_KEYS = new Set(['name', 'payload']);

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const operationsShape = (
  value: unknown
): readonly ProjectCommandOperation[] =>
  value as readonly ProjectCommandOperation[];

const unknownKey = (
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>
): string | undefined =>
  Object.keys(value).find((key) => !allowed.has(key));

export const parseRunRequest = (
  value: unknown
): ParseRunRequestResult => {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: {
        code: 'invalid_batch',
        path: '$',
        expected: 'run request object'
      }
    };
  }
  const requestUnknownKey = unknownKey(
    value,
    REQUEST_KEYS
  );
  if (requestUnknownKey) {
    return {
      ok: false,
      error: {
        code: 'invalid_batch',
        path: requestUnknownKey,
        expected: 'operations'
      }
    };
  }
  if (
    !Array.isArray(value.operations) ||
    value.operations.length === 0 ||
    value.operations.length > 64
  ) {
    return {
      ok: false,
      error: {
        code: 'invalid_batch',
        path: '$',
        expected: '1-64 operations'
      }
    };
  }
  for (let index = 0; index < value.operations.length; index += 1) {
    const operation: unknown = value.operations[index];
    if (
      !isRecord(operation) ||
      typeof operation.name !== 'string' ||
      !('payload' in operation) ||
      !getAgentCommandDefinition(operation.name)
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_batch',
          path: `operations[${index}]`,
          expected: 'registered command operation'
        }
      };
    }
    const operationUnknownKey = unknownKey(
      operation,
      OPERATION_KEYS
    );
    if (operationUnknownKey) {
      return {
        ok: false,
        error: {
          code: 'invalid_batch',
          path: `operations[${index}].${operationUnknownKey}`,
          expected: 'name or payload'
        }
      };
    }
  }
  return {
    ok: true,
    request: {
      operations: operationsShape(value.operations)
    }
  };
};
