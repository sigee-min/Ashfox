import type { ProjectDocument } from '../model';
import { validateProjectDocument } from '../validation';
import type { CommandApplication } from './definition';
import { getCommandDefinition } from './registry';
import type {
  CommandBatch,
  CommandBatchFailure,
  CommandBatchResult,
  CommandEffects,
  InvalidatedArea
} from './types';

const MAX_BATCH_OPERATIONS = 64;

const failure = (
  document: ProjectDocument,
  error: CommandBatchFailure['error'],
  findings?: CommandBatchFailure['findings']
): CommandBatchFailure => ({
  ok: false,
  currentRevision: document.revision,
  error,
  ...(findings ? { findings } : {})
});

const validateBatch = (
  document: ProjectDocument,
  batch: CommandBatch
): CommandBatchFailure | null => {
  if (batch.batchId.trim().length === 0) {
    return failure(document, {
      code: 'invalid_batch',
      message: 'Batch ID is required.',
      path: 'batchId',
      expected: 'non-empty string'
    });
  }
  if (batch.baseRevision !== document.revision) {
    return failure(document, {
      code: 'revision_mismatch',
      message: 'Batch revision does not match the active project.',
      path: 'baseRevision',
      expected: document.revision
    });
  }
  if (
    batch.operations.length === 0 ||
    batch.operations.length > MAX_BATCH_OPERATIONS
  ) {
    return failure(document, {
      code: 'invalid_batch',
      message: 'Batch operation count is outside the allowed range.',
      path: 'operations',
      expected: `1-${MAX_BATCH_OPERATIONS} operations`
    });
  }
  for (let index = 0; index < batch.operations.length; index += 1) {
    const operation = batch.operations[index];
    const definition = getCommandDefinition(operation.name);
    if (!definition) {
      return failure(document, {
        code: 'invalid_payload',
        message: `Command "${String(operation.name)}" is not registered.`,
        path: `operations[${index}].name`,
        expected: 'registered command name'
      });
    }
    const issue = definition.validate(operation.payload);
    if (issue) {
      return failure(document, {
        code: 'invalid_payload',
        message: issue.message,
        path: `operations[${index}].payload${issue.path.slice(1)}`,
        expected: issue.expected
      });
    }
  }
  return null;
};

const mergeUnique = <T>(
  left: readonly T[],
  right: readonly T[]
): readonly T[] => [...new Set([...left, ...right])];

const mergeEffects = (
  current: CommandEffects,
  next: CommandEffects
): CommandEffects => ({
  createdEntityIds: mergeUnique(
    current.createdEntityIds,
    next.createdEntityIds
  ),
  changedEntityIds: mergeUnique(
    current.changedEntityIds,
    next.changedEntityIds
  ),
  removedEntityIds: mergeUnique(
    current.removedEntityIds,
    next.removedEntityIds
  ),
  invalidated: mergeUnique<InvalidatedArea>(
    current.invalidated,
    next.invalidated
  )
});

const emptyEffects = (): CommandEffects => ({
  createdEntityIds: [],
  changedEntityIds: [],
  removedEntityIds: [],
  invalidated: []
});

const applyOperation = (
  document: ProjectDocument,
  batch: CommandBatch,
  index: number
): CommandApplication | CommandBatchFailure => {
  const operation = batch.operations[index];
  const definition = getCommandDefinition(operation.name);
  if (!definition) {
    return failure(document, {
      code: 'invalid_payload',
      message: `Command "${String(operation.name)}" is not registered.`,
      path: `operations[${index}].name`
    });
  }
  const result = definition.apply(document, operation.payload);
  if (result.ok) return result.value;
  return failure(document, {
    ...result.error,
    path: result.error.path
      ? `operations[${index}].${result.error.path}`
      : `operations[${index}]`
  });
};

export const executeCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch
): CommandBatchResult => {
  const batchFailure = validateBatch(document, batch);
  if (batchFailure) return batchFailure;

  let workingDocument = document;
  let effects = emptyEffects();
  const summaries: string[] = [];
  for (let index = 0; index < batch.operations.length; index += 1) {
    const applied = applyOperation(workingDocument, batch, index);
    if ('ok' in applied) return applied;
    workingDocument = applied.document;
    effects = mergeEffects(effects, applied.effects);
    summaries.push(applied.summary);
  }

  if (workingDocument === document) {
    return failure(document, {
      code: 'no_change',
      message: 'Batch does not change the active project.'
    });
  }

  const report = validateProjectDocument(workingDocument);
  if (!report.valid) {
    return failure(
      document,
      {
        code: 'invalid_state',
        message: 'Batch result violates project invariants.',
        path: report.findings[0]?.path
      },
      report.findings
    );
  }

  return {
    ok: true,
    document: workingDocument,
    summary: summaries.join('; '),
    effects,
    findings: report.findings
  };
};
