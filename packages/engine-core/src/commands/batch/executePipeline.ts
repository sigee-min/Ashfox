import type { ProjectDocument } from '../../model';
import {
  validateProjectDocument,
  validateProjectDocumentCandidate
} from '../../validation/project/validate';
import type {
  CommandBatch,
  CommandBatchResult,
  CommandSource
} from '../types';
import {
  applyCommandOperation
} from './applyOperation';
import { deriveBatchTextures } from './deriveTextures';
import {
  emptyCommandEffects,
  mergeCommandEffects
} from './effects';
import { commandBatchFailure } from './failure';
import { validateCommandBatch } from './validate';
import {
  createCommandExecutionContext,
  type CommandExecutionContext
} from './context';

export const executeCommandBatchPipeline = (
  document: ProjectDocument,
  batch: CommandBatch,
  source: CommandSource,
  context: CommandExecutionContext = createCommandExecutionContext()
): CommandBatchResult => {
  const batchFailure = validateCommandBatch(
    document,
    batch,
    source
  );
  if (batchFailure) return batchFailure;

  let workingDocument = document;
  let effects = emptyCommandEffects();
  const summaries: string[] = [];
  for (let index = 0; index < batch.operations.length; index += 1) {
    const applied = applyCommandOperation(
      workingDocument,
      batch,
      index,
      source,
      context
    );
    if ('ok' in applied) return applied;
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
  const report = context.validationAttestation
    ? validateProjectDocumentCandidate(
        workingDocument,
        context.validationAttestation,
        context.computation
      )
    : validateProjectDocument(workingDocument);
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
