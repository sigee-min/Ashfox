import type {
  IntentProgramDiagnostic,
  IntentProgramSpan
} from './types';

export type IntentProgramTokenKind =
  | 'word'
  | 'string'
  | 'open'
  | 'close'
  | 'line'
  | 'end';

export interface IntentProgramToken {
  kind: IntentProgramTokenKind;
  value: string;
  span: IntentProgramSpan;
}

export const fallbackIntentProgramSpan: IntentProgramSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 }
};

const position = (source: string, offset: number) => {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const lineStart = before.lastIndexOf('\n') + 1;
  return { offset, line, column: offset - lineStart + 1 };
};

export const intentProgramSpan = (
  source: string,
  start: number,
  end: number
): IntentProgramSpan => ({
  start: position(source, start),
  end: position(source, end)
});

export const intentProgramStatementSpan = (
  tokens: readonly IntentProgramToken[]
): IntentProgramSpan => ({
  start: tokens[0]!.span.start,
  end: tokens[tokens.length - 1]!.span.end
});

export const tokenizeIntentProgram = (source: string): {
  tokens: readonly IntentProgramToken[];
  diagnostics: readonly IntentProgramDiagnostic[];
} => {
  const tokens: IntentProgramToken[] = [];
  const diagnostics: IntentProgramDiagnostic[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (character === ' ' || character === '\t' || character === '\r') {
      index += 1;
      continue;
    }
    if (character === '\n' || character === ';') {
      tokens.push({ kind: 'line', value: character, span: intentProgramSpan(source, index, index + 1) });
      index += 1;
      continue;
    }
    if (character === '{' || character === '}') {
      tokens.push({
        kind: character === '{' ? 'open' : 'close',
        value: character,
        span: intentProgramSpan(source, index, index + 1)
      });
      index += 1;
      continue;
    }
    if (character === '#') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '"') {
      const start = index;
      let value = '';
      let closed = false;
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        if (current === '"') {
          index += 1;
          closed = true;
          break;
        }
        if (current === '\n' || current === '\r') break;
        if (current === '\\') {
          const escaped = source[index + 1];
          if (escaped === '"' || escaped === '\\') {
            value += escaped;
            index += 2;
            continue;
          }
          const end = escaped === undefined || escaped === '\n' || escaped === '\r'
            ? index + 1
            : index + 2;
          diagnostics.push({
            severity: 'error',
            code: 'intent.invalid_escape',
            message: 'Only \\" and \\\\ escapes are allowed in quoted strings.',
            span: intentProgramSpan(source, index, end)
          });
          index = end;
          continue;
        }
        value += current;
        index += 1;
      }
      if (!closed) {
        diagnostics.push({
          severity: 'error',
          code: 'intent.unclosed_string',
          message: 'Quoted strings must close on the same line.',
          span: intentProgramSpan(source, start, index)
        });
      }
      tokens.push({ kind: 'string', value, span: intentProgramSpan(source, start, index) });
      continue;
    }
    const start = index;
    while (index < source.length && !/[\s;{}#]/.test(source[index]!)) index += 1;
    tokens.push({ kind: 'word', value: source.slice(start, index), span: intentProgramSpan(source, start, index) });
  }
  tokens.push({ kind: 'end', value: '', span: intentProgramSpan(source, source.length, source.length) });
  return { tokens, diagnostics };
};
