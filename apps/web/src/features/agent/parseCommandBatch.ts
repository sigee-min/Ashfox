import {
  getAgentCommandDefinition,
  type CommandBatch
} from '@ashfox/engine-core';

interface ParseSuccess {
  ok: true;
  batch: CommandBatch;
}

interface ParseFailure {
  ok: false;
  error: {
    code: 'invalid_batch';
    path: string;
    expected: string;
  };
}

export type ParseCommandBatchResult = ParseSuccess | ParseFailure;

const BATCH_KEYS = new Set([
  'batchId',
  'baseProjectId',
  'baseRevision',
  'operations'
]);
const OPERATION_KEYS = new Set(['name', 'payload']);

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const commandBatchShape = (value: unknown): CommandBatch =>
  value as CommandBatch;

const unknownKey = (
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>
): string | undefined =>
  Object.keys(value).find((key) => !allowed.has(key));

export const parseCommandBatch = (
  value: unknown
): ParseCommandBatchResult => {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: {
        code: 'invalid_batch',
        path: '$',
        expected: 'command batch object'
      }
    };
  }
  const batchUnknownKey = unknownKey(
    value,
    BATCH_KEYS
  );
  if (batchUnknownKey) {
    return {
      ok: false,
      error: {
        code: 'invalid_batch',
        path: batchUnknownKey,
        expected: 'registered command batch property'
      }
    };
  }
  if (
    typeof value.batchId !== 'string' ||
    typeof value.baseProjectId !== 'string' ||
    value.baseProjectId.trim().length === 0 ||
    typeof value.baseRevision !== 'string' ||
    !Array.isArray(value.operations) ||
    value.operations.length === 0 ||
    value.operations.length > 64
  ) {
    return {
      ok: false,
      error: {
        code: 'invalid_batch',
        path: '$',
        expected:
          'batchId, baseProjectId, baseRevision, and 1-64 operations'
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
    batch: commandBatchShape(value)
  };
};
