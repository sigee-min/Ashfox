import assert from 'node:assert/strict';

import { parseIntentProgram } from '../../../src/project/program';

export const shape = [
  'axis longitudinal',
  'span medium',
  'chord broad',
  'tip pointed',
  'offset posterior',
  'edge convex'
] as const;

export const schemaSource = (
  face: readonly string[],
  surfaceShape: readonly string[] = shape
): string => [
  'metadata {',
  '  name "Schema fixture"',
  '  track hero',
  '  domain organism',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support none',
  '  body {',
  '    core torso',
  '    mass head single parent torso anchor front growth forward lane center',
  '  }',
  '  surface belly single fin parent torso anchor bottom growth down lane center',
  '  shape belly {',
  ...surfaceShape.map((entry) => `    ${entry}`),
  '  }',
  '  face {',
  ...face.map((entry) => `    ${entry}`),
  '  }',
  '}',
  'animation { idle breathe target head }',
  'appearance {',
  '  palette ocean',
  '  texture mottle scale broad density balanced contrast subtle',
  '  seed auto',
  '}'
].join('\n');

export const validSchemaSource = (): string => schemaSource([
  'full parent head',
  'eyes paired gaze center',
  'nose absent',
  'mouth neutral'
]);

export interface ExpectedStatementDiagnostic {
  readonly token: string;
  readonly code: string;
  readonly field: string;
  readonly schemaField?: string;
}

export const assertStatementDiagnostics = (
  program: string,
  statement: string,
  expected: readonly ExpectedStatementDiagnostic[]
): void => {
  const statementStart = program.indexOf(statement);
  assert.notEqual(statementStart, -1, `Missing statement: ${statement}`);
  const statementEnd = statementStart + statement.length;
  const actual = parseIntentProgram(program).diagnostics.filter((entry) =>
    entry.span.start.offset >= statementStart &&
    entry.span.start.offset < statementEnd
  );
  assert.equal(actual.length, expected.length);

  let tokenSearchStart = statementStart;
  for (const [index, expectation] of expected.entries()) {
    const tokenOffset = program.indexOf(expectation.token, tokenSearchStart);
    assert.ok(tokenOffset >= tokenSearchStart, expectation.token);
    tokenSearchStart = tokenOffset + expectation.token.length;
    assert.equal(actual[index]?.code, expectation.code);
    assert.match(actual[index]?.message ?? '', new RegExp(expectation.field, 'i'));
    assert.equal(actual[index]?.span.start.offset, tokenOffset);
    assert.equal(actual[index]?.span.end.offset, tokenOffset + expectation.token.length);
  }
};
