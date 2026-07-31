import type { ProjectDocument } from '../../model';
import { validateCompiledPartOperation } from '../compiledPartPolicy';
import type { CommandApplication } from '../definition';
import { getCommandDefinition } from '../registry';
import type {
  CommandBatch,
  CommandBatchFailure
} from '../types';
import { commandBatchFailure } from './failure';

export const applyCommandOperation = (
  document: ProjectDocument,
  batch: CommandBatch,
  index: number
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
  const policyIssue = validateCompiledPartOperation(document, operation);
  if (policyIssue) {
    return commandBatchFailure(document, {
      code: 'invalid_state',
      message: policyIssue.message,
      path: `operations[${index}].${policyIssue.path}`,
      expected: 'model.parts command for generated geometry'
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

export const changedMotionKeyCount = (
  before: ProjectDocument,
  after: ProjectDocument,
  operation: CommandBatch['operations'][number]
): number => {
  if (operation.name !== 'animation.motion.upsert') return 0;
  const beforeChannels =
    before.animations[operation.payload.clipId]?.channels ?? {};
  const afterChannels =
    after.animations[operation.payload.clipId]?.channels ?? {};
  return Object.entries(afterChannels).reduce(
    (count, [id, channel]) =>
      count + (beforeChannels[id] === channel ? 0 : channel.keys.length),
    0
  );
};
