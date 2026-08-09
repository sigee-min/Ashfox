import type { ProjectDocument } from '../../model';
import type { CommandApplication } from '../definition';
import { getCommandDefinition } from '../registry';
import type {
  CommandBatch,
  CommandBatchFailure,
  CommandSource
} from '../types';
import { commandBatchFailure } from './failure';

export const applyCommandOperation = (
  document: ProjectDocument,
  batch: CommandBatch,
  index: number,
  _source: CommandSource
): CommandApplication | CommandBatchFailure => {
  const operation = batch.operations[index];
  const definition = getCommandDefinition(operation.name);
  if (!definition) {
    return commandBatchFailure(document, {
      code: 'invalid_payload',
      message: `Command "${String(operation.name)}" is not registered.`,
      path: `operations[${index}].name`
    });
  }
  const result = definition.apply(document, operation.payload);
  if (result.ok) return result.value;
  const {
    pathScope = 'operation',
    ...commandError
  } = result.error;
  return commandBatchFailure(document, {
    ...commandError,
    path: commandError.path
      ? pathScope === 'document'
        ? commandError.path
        : `operations[${index}].${commandError.path}`
      : `operations[${index}]`
  });
};
