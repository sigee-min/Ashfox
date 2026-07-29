import {
  getCommandDefinition,
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

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const commandBatchShape = (value: unknown): CommandBatch =>
  value as CommandBatch;

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
  if (
    typeof value.batchId !== 'string' ||
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
        expected: 'batchId, baseRevision, and 1-64 operations'
      }
    };
  }
  for (let index = 0; index < value.operations.length; index += 1) {
    const operation: unknown = value.operations[index];
    if (
      !isRecord(operation) ||
      typeof operation.name !== 'string' ||
      !('payload' in operation) ||
      !getCommandDefinition(operation.name)
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
  }
  return {
    ok: true,
    batch: commandBatchShape(value)
  };
};
