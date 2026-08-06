import type { ProjectDocument } from '../../model';
import {
  validateAgentAuthoringMutation,
  validateAgentAuthoringResult
} from '../authoringEnforcement';
import { validateCompiledPartOperation } from '../compiledPartPolicy';
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
  source: CommandSource
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
  const authoringIssue = source === 'agent'
    ? validateAgentAuthoringMutation(document, operation)
    : null;
  if (authoringIssue) {
    return commandBatchFailure(document, {
      code: 'invalid_state',
      ...authoringIssue,
      path: `operations[${index}].${authoringIssue.path}`
    });
  }
  const result = definition.apply(document, operation.payload);
  if (result.ok) {
    const resultingAuthoringIssue = source === 'agent'
      ? validateAgentAuthoringResult(result.value.document, operation)
      : null;
    if (resultingAuthoringIssue) {
      return commandBatchFailure(document, {
        code: 'invalid_state',
        ...resultingAuthoringIssue,
        path: `operations[${index}].${resultingAuthoringIssue.path}`
      });
    }
    return result.value;
  }
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
