import type {
  IntentProgramDiagnostic,
  IntentProgramSpan
} from '../../project/intentProgramTypes';

const fallbackSpan: IntentProgramSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 }
};

export const intentProgramDiagnostic = (
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  path: string,
  code: string,
  message: string
): IntentProgramDiagnostic => ({
  severity: 'error',
  code,
  message,
  span: sourceMap[path] ?? fallbackSpan
});
