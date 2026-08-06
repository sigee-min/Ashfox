import type { ProjectDocument } from '../model';
import { commandBatchFailure } from './batch/failure';
import { executeCommandBatchPipeline } from './batch/executePipeline';
import type {
  CommandBatch,
  CommandBatchResult,
  CommandSource
} from './types';

const executeCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch,
  source: CommandSource
): CommandBatchResult => {
  try {
    return executeCommandBatchPipeline(
      structuredClone(document),
      structuredClone(batch),
      source
    );
  } catch (error) {
    return commandBatchFailure(document, {
      code: 'invalid_state',
      message:
        error instanceof Error
          ? `Command batch terminated without changes: ${error.message}`
          : 'Command batch terminated without changes.'
    });
  }
};

export const executeAgentCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch
): CommandBatchResult => executeCommandBatch(document, batch, 'agent');

export const executeWebCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch
): CommandBatchResult => executeCommandBatch(document, batch, 'web');

export const executeImportCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch
): CommandBatchResult => executeCommandBatch(document, batch, 'import');

export const executeSystemCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch
): CommandBatchResult => executeCommandBatch(document, batch, 'system');
