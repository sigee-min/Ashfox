import type { ProjectDocument } from '../model';
import { commandBatchFailure } from './batch/failure';
import { executeCommandBatchPipeline } from './batch/executePipeline';
import type { ExecuteCommandBatchOptions } from './batch/types';
import { isCommandSource } from './batch/validateBatch';
import type {
  CommandBatch,
  CommandBatchResult
} from './types';

export type { ExecuteCommandBatchOptions } from './batch/types';

export const executeCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch,
  options: ExecuteCommandBatchOptions
): CommandBatchResult => {
  try {
    if (!isCommandSource(options?.source)) {
      return commandBatchFailure(document, {
        code: 'invalid_batch',
        message: 'A trusted command source is required.',
        path: 'source',
        expected: 'web | agent | import | system'
      });
    }
    return executeCommandBatchPipeline(
      structuredClone(document),
      structuredClone(batch),
      options
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
