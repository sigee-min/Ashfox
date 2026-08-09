import {
  parseIntentProgram,
  type IntentProgramParseResult
} from '../../project/intentProgram';

export const parseIntentProgramSource = (
  source: string
): IntentProgramParseResult => parseIntentProgram(source);

export const intentProgramError = (
  result: IntentProgramParseResult
): { message: string; path: string; expected?: string } | null => {
  const issue = result.diagnostics.find(
    (diagnostic) => diagnostic.severity === 'error'
  );
  return issue
    ? {
        message: issue.message,
        path: `payload.source:${issue.span.start.line}:${issue.span.start.column}`,
        expected: issue.code
      }
    : null;
};
