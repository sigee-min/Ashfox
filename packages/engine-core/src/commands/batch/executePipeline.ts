import { MOTION_AUTHORING_LIMITS } from '../../animation/motionContract';
import type { ProjectDocument } from '../../model';
import { validateProjectDocument } from '../../validation';
import type {
  CommandBatch,
  CommandBatchResult
} from '../types';
import {
  applyCommandOperation,
  changedMotionKeyCount
} from './applyOperation';
import { deriveBatchTextures } from './deriveTextures';
import {
  emptyCommandEffects,
  mergeCommandEffects
} from './effects';
import { commandBatchFailure } from './failure';
import type { ExecuteCommandBatchOptions } from './types';
import { validateCommandBatch } from './validateBatch';

export const executeCommandBatchPipeline = (
  document: ProjectDocument,
  batch: CommandBatch,
  options: ExecuteCommandBatchOptions
): CommandBatchResult => {
  const batchFailure = validateCommandBatch(
    document,
    batch,
    options.source
  );
  if (batchFailure) return batchFailure;

  let workingDocument = document;
  let effects = emptyCommandEffects();
  let motionKeyCount = 0;
  const summaries: string[] = [];
  for (let index = 0; index < batch.operations.length; index += 1) {
    const beforeOperation = workingDocument;
    const applied = applyCommandOperation(workingDocument, batch, index);
    if ('ok' in applied) return applied;
    motionKeyCount += changedMotionKeyCount(
      beforeOperation,
      applied.document,
      batch.operations[index]
    );
    if (motionKeyCount > MOTION_AUTHORING_LIMITS.maxKeysPerBatch) {
      return commandBatchFailure(document, {
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
    effects = mergeCommandEffects(effects, applied.effects);
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
    return commandBatchFailure(document, {
      code: 'no_change',
      message: 'Batch does not change the active project.'
    });
  }
  const report = validateProjectDocument(workingDocument);
  if (!report.valid) {
    return commandBatchFailure(
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
