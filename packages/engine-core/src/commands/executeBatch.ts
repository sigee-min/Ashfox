import type { ProjectDocument } from '../model';
import {
  MOTION_AUTHORING_LIMITS
} from '../animation/motionContract';
import {
  deriveGeneratedTextures
} from '../textures/textureRecipe';
import { validateProjectDocument } from '../validation';
import {
  validateCompiledPartOperation
} from './compiledPartPolicy';
import type { CommandApplication } from './definition';
import {
  commandAllowedForSource,
  getCommandDefinition
} from './registry';
import type {
  CommandBatch,
  CommandBatchFailure,
  CommandBatchResult,
  CommandEffects,
  InvalidatedArea,
  CommandSource
} from './types';

const MAX_BATCH_OPERATIONS = 64;

export interface ExecuteCommandBatchOptions {
  source: CommandSource;
}

const isCommandSource = (value: unknown): value is CommandSource =>
  value === 'web' ||
  value === 'agent' ||
  value === 'import' ||
  value === 'system';

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
  batch: CommandBatch,
  source: CommandSource
): CommandBatchFailure | null => {
  if (batch.batchId.trim().length === 0) {
    return failure(document, {
      code: 'invalid_batch',
      message: 'Batch ID is required.',
      path: 'batchId',
      expected: 'non-empty string'
    });
  }
  if (
    typeof batch.baseProjectId !== 'string' ||
    batch.baseProjectId.trim().length === 0
  ) {
    return failure(document, {
      code: 'invalid_batch',
      message: 'Base project ID is required.',
      path: 'baseProjectId',
      expected: 'non-empty string'
    });
  }
  if (batch.baseProjectId !== document.id) {
    return failure(document, {
      code: 'project_mismatch',
      message: 'Batch project does not match the active project.',
      path: 'baseProjectId',
      expected: document.id
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
    if (!commandAllowedForSource(operation.name, source)) {
      return failure(document, {
        code: 'invalid_payload',
        message:
          `Command "${operation.name}" is not available to ${source}.`,
        path: `operations[${index}].name`,
        expected: 'command available to this trusted source'
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

type EffectState = 'created' | 'changed' | 'removed';

const effectStates = (
  effects: CommandEffects
): Map<string, EffectState> => {
  const states = new Map<string, EffectState>();
  effects.createdEntityIds.forEach((id) => states.set(id, 'created'));
  effects.changedEntityIds.forEach((id) => {
    if (!states.has(id)) states.set(id, 'changed');
  });
  effects.removedEntityIds.forEach((id) => {
    const current = states.get(id);
    if (current === 'created') {
      states.delete(id);
    } else {
      states.set(id, 'removed');
    }
  });
  return states;
};

const mergeEntityEffects = (
  current: CommandEffects,
  next: CommandEffects
): Pick<
  CommandEffects,
  'createdEntityIds' | 'changedEntityIds' | 'removedEntityIds'
> => {
  const states = effectStates(current);
  for (const id of next.createdEntityIds) {
    const previous = states.get(id);
    states.set(
      id,
      previous === undefined || previous === 'created'
        ? 'created'
        : 'changed'
    );
  }
  for (const id of next.changedEntityIds) {
    if (!states.has(id)) states.set(id, 'changed');
  }
  for (const id of next.removedEntityIds) {
    if (states.get(id) === 'created') {
      states.delete(id);
    } else {
      states.set(id, 'removed');
    }
  }
  const ids = [...states.keys()].sort();
  return {
    createdEntityIds: ids.filter((id) => states.get(id) === 'created'),
    changedEntityIds: ids.filter((id) => states.get(id) === 'changed'),
    removedEntityIds: ids.filter((id) => states.get(id) === 'removed')
  };
};

const mergeEffects = (
  current: CommandEffects,
  next: CommandEffects
): CommandEffects => {
  const entities = mergeEntityEffects(current, next);
  return {
    ...entities,
    invalidated: [
      ...new Set<InvalidatedArea>([
        ...current.invalidated,
        ...next.invalidated
      ])
    ]
  };
};

const emptyEffects = (): CommandEffects => ({
  createdEntityIds: [],
  changedEntityIds: [],
  removedEntityIds: [],
  invalidated: []
});

const deriveBatchTextures = (
  originalDocument: ProjectDocument,
  document: ProjectDocument,
  effects: CommandEffects
):
  | {
      ok: true;
      document: ProjectDocument;
      effects: CommandEffects;
    }
  | CommandBatchFailure => {
  const derived = deriveGeneratedTextures(document);
  if (!derived.ok) {
    return failure(originalDocument, {
      code: 'invalid_state',
      message: derived.message,
      path: derived.path,
      expected: derived.expected
    });
  }
  const changedEntityIds = [
    ...derived.changedNodeIds,
    ...derived.changedTextureIds
  ];
  const changed =
    derived.changedSettings || changedEntityIds.length > 0;
  return {
    ok: true,
    document: derived.document,
    effects: changed
      ? mergeEffects(effects, {
          createdEntityIds: [],
          changedEntityIds,
          removedEntityIds: [],
          invalidated: [
            'scene',
            'textures',
            'uv',
            'validation',
            'preview'
          ]
        })
      : effects
  };
};

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
  const policyIssue = validateCompiledPartOperation(document, operation);
  if (policyIssue) {
    return failure(document, {
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
  return failure(document, {
    ...commandError,
    path: commandError.path
      ? pathScope === 'document'
        ? commandError.path
        : `operations[${index}].${commandError.path}`
      : `operations[${index}]`
  });
};

const changedMotionKeyCount = (
  before: ProjectDocument,
  after: ProjectDocument,
  operation: CommandBatch['operations'][number]
): number => {
  if (operation.name !== 'animation.motion.upsert') {
    return 0;
  }
  const beforeChannels =
    before.animations[operation.payload.clipId]?.channels ??
    {};
  const afterChannels =
    after.animations[operation.payload.clipId]?.channels ??
    {};
  return Object.entries(afterChannels).reduce(
    (count, [id, channel]) =>
      count +
      (
        beforeChannels[id] === channel
          ? 0
          : channel.keys.length
      ),
    0
  );
};

const executeCommandBatchUnchecked = (
  document: ProjectDocument,
  batch: CommandBatch,
  options: ExecuteCommandBatchOptions
): CommandBatchResult => {
  const source = options.source;
  const batchFailure = validateBatch(document, batch, source);
  if (batchFailure) return batchFailure;

  let workingDocument = document;
  let effects = emptyEffects();
  let motionKeyCount = 0;
  const summaries: string[] = [];
  for (let index = 0; index < batch.operations.length; index += 1) {
    const beforeOperation = workingDocument;
    const applied = applyOperation(workingDocument, batch, index);
    if ('ok' in applied) return applied;
    motionKeyCount += changedMotionKeyCount(
      beforeOperation,
      applied.document,
      batch.operations[index]
    );
    if (
      motionKeyCount >
      MOTION_AUTHORING_LIMITS.maxKeysPerBatch
    ) {
      return failure(document, {
        code: 'invalid_batch',
        message:
          `Animation operations compile to ${motionKeyCount} changed keys, ` +
          `exceeding the ${MOTION_AUTHORING_LIMITS.maxKeysPerBatch}-key batch budget.`,
        path: 'operations',
        expected:
          `at most ${MOTION_AUTHORING_LIMITS.maxKeysPerBatch} changed animation keys`
      });
    }
    workingDocument = applied.document;
    effects = mergeEffects(effects, applied.effects);
    summaries.push(applied.summary);
  }

  const reconciled = deriveBatchTextures(
    document,
    workingDocument,
    effects
  );
  if (!reconciled.ok) return reconciled;
  workingDocument = reconciled.document;
  effects = reconciled.effects;

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

export const executeCommandBatch = (
  document: ProjectDocument,
  batch: CommandBatch,
  options: ExecuteCommandBatchOptions
): CommandBatchResult => {
  try {
    if (!isCommandSource(options?.source)) {
      return failure(document, {
        code: 'invalid_batch',
        message: 'A trusted command source is required.',
        path: 'source',
        expected: 'web | agent | import | system'
      });
    }
    return executeCommandBatchUnchecked(
      structuredClone(document),
      structuredClone(batch),
      options
    );
  } catch (error) {
    return failure(document, {
      code: 'invalid_state',
      message:
        error instanceof Error
          ? `Command batch terminated without changes: ${error.message}`
          : 'Command batch terminated without changes.'
    });
  }
};
