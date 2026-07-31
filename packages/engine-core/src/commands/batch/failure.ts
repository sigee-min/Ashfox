import type { ProjectDocument } from '../../model';
import type { CommandBatchFailure } from '../types';

export const commandBatchFailure = (
  document: ProjectDocument,
  error: CommandBatchFailure['error'],
  findings?: CommandBatchFailure['findings']
): CommandBatchFailure => ({
  ok: false,
  currentRevision: document.revision,
  error,
  ...(findings ? { findings } : {})
});
