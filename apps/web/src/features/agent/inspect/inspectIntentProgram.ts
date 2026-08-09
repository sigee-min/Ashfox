import {
  diagnoseIntentProgramSource,
  type IntentProgramPreviewDiagnostic,
  type ProjectDocument
} from '@ashfox/engine-core';

import type {
  InspectResult,
  IntentProgramInspectData
} from '../types';

const sourceOrder = (
  diagnostics: readonly IntentProgramPreviewDiagnostic[]
): readonly IntentProgramPreviewDiagnostic[] => diagnostics
  .map((diagnostic, index) => ({ diagnostic, index }))
  .sort((left, right) => {
    const leftOffset = left.diagnostic.span?.start.offset ?? Number.MAX_VALUE;
    const rightOffset = right.diagnostic.span?.start.offset ?? Number.MAX_VALUE;
    return leftOffset - rightOffset || left.index - right.index;
  })
  .map(({ diagnostic }) => diagnostic);

/** Read-only source lint. It has no project mutation or command authority. */
export const inspectIntentProgram = (
  document: ProjectDocument,
  source: string
): InspectResult => {
  const report = diagnoseIntentProgramSource(source);
  const data: IntentProgramInspectData = {
    kind: 'intent-program',
    valid: report.ok,
    diagnostics: sourceOrder(report.diagnostics)
  };
  return {
    ok: true,
    revision: document.revision,
    data
  };
};
