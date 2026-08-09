import type { IntentProgramToken } from '../lexer';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import type { IntentProgramReadContext } from './contract';
import {
  intentProgramAllowsOccurrence,
  normalizeIntentProgramName,
  resolveIntentProgramVocabulary
} from '../schema';
import {
  isIntentProgramVocabularyToken,
  sourceToken,
  sourceTrailingTokens
} from './schema';

export const readMetadataStatement = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const statementTokens = [keyword, ...values];
  const statements = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.metadata;
  const nameKeyword = statements.name.sourceTokens[0];
  const trackKeyword = statements.track.sourceTokens[0];
  const domainKeyword = statements.domain.sourceTokens[0];
  if (keyword.value === nameKeyword) {
    const schema = statements.name;
    const value = sourceToken(schema.sourceTokens, statementTokens, 'text');
    let valid = true;
    if (value?.kind !== 'string') {
      context.error(
        'intent.name_requires_quoted_string',
        'Use: name "Human-readable asset name".',
        value ?? keyword
      );
      valid = false;
    }
    for (const extra of sourceTrailingTokens(
      schema.sourceTokens,
      statementTokens
    )) {
      context.error(
        'intent.unexpected_name_value',
        `Unexpected name value "${extra.value}".`,
        extra
      );
      valid = false;
    }
    if (!valid || value?.kind !== 'string') return;
    if (!intentProgramAllowsOccurrence(
      context.raw.metadata.name === undefined ? 0 : 1,
      schema.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'name is declared more than once.', keyword);
      return;
    }
    const name = normalizeIntentProgramName(value.value);
    if (statements.name.cardinality > 0 &&
      INTENT_PROGRAM_LANGUAGE_SPECIFICATION.invariants.name.nonEmpty &&
      name.length === 0) {
      context.error('intent.invalid_name', 'name cannot be empty.', value);
      return;
    }
    context.raw.metadata.name = name;
    context.field('name', name, value.span);
    return;
  }
  if (keyword.value === trackKeyword) {
    const schema = statements.track;
    const vocabulary = resolveIntentProgramVocabulary(schema.enum);
    const value = sourceToken(schema.sourceTokens, statementTokens, 'value');
    let valid = isIntentProgramVocabularyToken(
      value,
      vocabulary
    );
    if (!valid) {
      context.error('intent.invalid_track', 'Use: track essential|hero.',
        value ?? keyword);
    }
    for (const extra of sourceTrailingTokens(
      schema.sourceTokens,
      statementTokens
    )) {
      context.error('intent.unexpected_track_value',
        `Unexpected track value "${extra.value}".`, extra);
      valid = false;
    }
    if (!valid || !isIntentProgramVocabularyToken(
      value,
      vocabulary
    )) return;
    if (!intentProgramAllowsOccurrence(
      context.raw.metadata.track === undefined ? 0 : 1,
      schema.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'track is declared more than once.', keyword);
      return;
    }
    context.raw.metadata.track = value.value;
    context.field(trackKeyword, value.value, value.span);
    return;
  }
  if (keyword.value === domainKeyword) {
    const schema = statements.domain;
    const vocabulary = resolveIntentProgramVocabulary(schema.enum);
    const value = sourceToken(schema.sourceTokens, statementTokens, 'value');
    let valid = isIntentProgramVocabularyToken(
      value,
      vocabulary
    );
    if (!valid) {
      context.error('intent.invalid_domain',
        'Use: domain organism|constructed.',
        value ?? keyword);
    }
    for (const extra of sourceTrailingTokens(
      schema.sourceTokens,
      statementTokens
    )) {
      context.error('intent.unexpected_domain_value',
        `Unexpected domain value "${extra.value}".`, extra);
      valid = false;
    }
    if (!valid || !isIntentProgramVocabularyToken(
      value,
      vocabulary
    )) return;
    if (!intentProgramAllowsOccurrence(
      context.raw.metadata.domain === undefined ? 0 : 1,
      schema.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'domain is declared more than once.', keyword);
      return;
    }
    context.raw.metadata.domain = value.value;
    context.field(domainKeyword, value.value, value.span);
    return;
  }
  context.error(
    'intent.wrong_authority',
    `Statement "${keyword.value}" does not belong in metadata.`,
    keyword
  );
};
