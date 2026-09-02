import { sourceLengthDiagnostic } from '../../source/lexer';
import type { SourceDiagnostic, SourcePosition, SourceSpan } from '../../source/contract';

export type ProgramTokenKind = 'identifier' | 'number' | 'string' | 'color' |
  'symbol' | 'eof';

export interface ProgramToken {
  readonly kind: ProgramTokenKind;
  readonly value: string;
  readonly span: SourceSpan;
}

const identifierStart = (value: string): boolean => /[A-Za-z_]/.test(value);
const identifierPart = (value: string): boolean => /[A-Za-z0-9_]/.test(value);
const hex = (value: string): boolean => /^[0-9A-Fa-f]{6}$/.test(value);

type SpanFactory = (start: number, end: number) => SourceSpan;

const lineStartsFor = (source: string): readonly number[] => {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  return starts;
};

const positionFrom = (
  source: string,
  starts: readonly number[],
  offset: number
): SourcePosition => {
  const bounded = Math.max(0, Math.min(Math.ceil(offset), source.length));
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle]! <= bounded) low = middle;
    else high = middle;
  }
  return Object.freeze({
    offset,
    line: low + 1,
    column: bounded - starts[low]! + 1 + Math.max(0, offset - source.length)
  });
};

const spanFactoryFor = (source: string): SpanFactory => {
  const starts = lineStartsFor(source);
  return (start, end): SourceSpan => Object.freeze({
    start: positionFrom(source, starts, start),
    end: positionFrom(source, starts, end)
  });
};

const issue = (
  code: string,
  message: string,
  span: SourceSpan
): SourceDiagnostic => Object.freeze({ severity: 'error', code, message, span });

const token = (
  kind: ProgramTokenKind,
  value: string,
  span: SpanFactory,
  start: number,
  end: number
): ProgramToken => Object.freeze({ kind, value, span: span(start, end) });

/** Lexer for the versioned source language. Newlines are insignificant. */
export const lexProgramSource = (source: string): {
  readonly tokens: readonly ProgramToken[];
  readonly diagnostics: readonly SourceDiagnostic[];
} => {
  const span = spanFactoryFor(source);
  const lengthIssue = sourceLengthDiagnostic(source);
  if (lengthIssue) return Object.freeze({
    tokens: Object.freeze([token('eof', '', span, source.length, source.length)]),
    diagnostics: Object.freeze([lengthIssue])
  });
  const tokens: ProgramToken[] = [];
  const diagnostics: SourceDiagnostic[] = [];
  let index = 0;
  const add = (kind: ProgramTokenKind, value: string, start: number): void => {
    tokens.push(token(kind, value, span, start, index));
  };
  const header = 'ashfox-model';
  while (index < source.length) {
    const current = source[index]!;
    if (/\s/.test(current)) {
      index += 1;
      continue;
    }
    if (current === '/' && source[index + 1] === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (current === '/' && source[index + 1] === '*') {
      const start = index;
      index += 2;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          index += 2;
          closed = true;
          break;
        }
        index += 1;
      }
      if (!closed) diagnostics.push(issue('program.unclosed-comment',
        'Block comments must close with */.', span(start, index)));
      continue;
    }
    if (current === '"') {
      const start = index;
      let value = '';
      index += 1;
      let closed = false;
      while (index < source.length) {
        const character = source[index]!;
        if (character === '"') {
          index += 1;
          closed = true;
          break;
        }
        if (character === '\n' || character === '\r') break;
        if (character === '\\') {
          const escaped = source[index + 1];
          if (escaped === '"' || escaped === '\\') {
            value += escaped;
            index += 2;
            continue;
          }
          diagnostics.push(issue('program.invalid-escape',
            'Only \\" and \\\\ escapes are allowed in strings.',
            span(index, Math.min(source.length, index + 2))));
          index += escaped === undefined ? 1 : 2;
          continue;
        }
        value += character;
        index += 1;
      }
      if (!closed) diagnostics.push(issue('program.unclosed-string',
        'Quoted strings must close on the same line.', span(start, index)));
      add('string', value, start);
      continue;
    }
    if (current === '#') {
      const start = index;
      index += 1;
      while (index < source.length && /[0-9A-Fa-f]/.test(source[index]!)) index += 1;
      const value = source.slice(start + 1, index);
      if (!hex(value)) diagnostics.push(issue('program.invalid-color',
        'Colors must contain exactly six hexadecimal digits after #.',
        span(start, index)));
      add('color', '#' + value.toLowerCase(), start);
      continue;
    }
    /* The grammar header is the one hyphenated keyword. Keep it atomic only
     * at the beginning of the token stream; authored identifiers elsewhere
     * must lex '-' as the subtraction operator. */
    if (tokens.length === 0 && source.startsWith(header, index) &&
      !/[A-Za-z0-9_$]/.test(source[index + header.length] ?? '')) {
      const start = index;
      index += header.length;
      add('identifier', header, start);
      continue;
    }
    if (/[0-9]/.test(current) || current === '.' && /[0-9]/.test(source[index + 1] ?? '')) {
      const start = index;
      if (current === '.') index += 1;
      while (index < source.length && /[0-9]/.test(source[index]!)) index += 1;
      if (source[index] === '.') {
        index += 1;
        while (index < source.length && /[0-9]/.test(source[index]!)) index += 1;
      }
      while (index < source.length && /[A-Za-z%]/.test(source[index]!)) index += 1;
      add('number', source.slice(start, index), start);
      continue;
    }
    if (identifierStart(current) || current === '$' &&
      (identifierStart(source[index + 1] ?? '') || source[index + 1] === '{')) {
      const start = index;
      if (identifierStart(current)) index += 1;
      while (index < source.length) {
        if (identifierPart(source[index]!)) {
          index += 1;
          continue;
        }
        if (source[index] !== '$') break;
        const marker = index;
        index += 1;
        if (source[index] === '{') {
          index += 1;
          if (!identifierStart(source[index] ?? '')) {
            diagnostics.push(issue('program.invalid-interpolation',
              'Interpolation must name an identifier inside ${...}.',
              span(marker, Math.min(source.length, index + 1))));
          } else {
            index += 1;
            while (index < source.length && identifierPart(source[index]!)) index += 1;
          }
          if (source[index] === '}') index += 1;
          else diagnostics.push(issue('program.invalid-interpolation',
            'Braced interpolation must close with }.', span(marker, index)));
          continue;
        }
        if (!identifierStart(source[index] ?? '')) {
          diagnostics.push(issue('program.invalid-interpolation',
            'Interpolation must name an identifier after $.',
            span(marker, Math.min(source.length, index + 1))));
          break;
        }
        index += 1;
        while (index < source.length && identifierPart(source[index]!)) index += 1;
      }
      add('identifier', source.slice(start, index), start);
      continue;
    }
    const two = source.slice(index, index + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=') {
      const start = index;
      index += 2;
      add('symbol', two, start);
      continue;
    }
    if ('{}[](),;=:+-*/%<>.'.includes(current)) {
      const start = index;
      index += 1;
      add('symbol', current, start);
      continue;
    }
    diagnostics.push(issue('program.invalid-character',
      'Unexpected character "' + current + '".', span(index, index + 1)));
    index += 1;
  }
  tokens.push(token('eof', '', span, source.length, source.length));
  return Object.freeze({
    tokens: Object.freeze(tokens), diagnostics: Object.freeze(diagnostics)
  });
};
