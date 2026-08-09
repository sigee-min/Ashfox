import { PROJECT_APPEARANCE_SPECIFICATION } from '../contract';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../program/language';
import type { IntentProgramToken } from '../../program/lexer';
import type { RawIntentProgramAppearance } from '../../program/syntax';
import {
  intentProgramAllowsOccurrence,
  resolveIntentProgramVocabulary
} from '../../program/schema';
import {
  isIntentProgramVocabularyToken,
  sourceToken,
  sourceTrailingTokens
} from '../../program/read/schema';
import type { AppearanceSourceReporter } from './contract';

export const readPaletteSource = (
  raw: RawIntentProgramAppearance,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[],
  reporter: AppearanceSourceReporter
): void => {
  const schema =
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.appearance.palette;
  const palettes = resolveIntentProgramVocabulary(schema.enum);
  const statementTokens = [keyword, ...values];
  const value = sourceToken(schema.sourceTokens, statementTokens, 'value');
  let valid = isIntentProgramVocabularyToken(
    value,
    palettes
  );
  if (!valid) {
    reporter.error(
      'intent.invalid_appearance_palette',
      `Expected palette to be one of: ${
        palettes.join(', ')
      }.`,
      value ?? keyword
    );
  }
  for (const extra of sourceTrailingTokens(
    schema.sourceTokens,
    statementTokens
  )) {
    reporter.error(
      'intent.unexpected_appearance_palette_value',
      `Unexpected palette value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || !isIntentProgramVocabularyToken(
    value,
    palettes
  )) return;
  if (!intentProgramAllowsOccurrence(
    raw.palette === undefined ? 0 : 1,
    schema.cardinality
  )) {
    reporter.error(
      'intent.duplicate_appearance_palette',
      'appearance palette is declared more than once.',
      value
    );
    return;
  }
  raw.palette = value.value;
  reporter.field('appearance.palette', value.value, value.span);
};

export const readSeedSource = (
  raw: RawIntentProgramAppearance,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[],
  reporter: AppearanceSourceReporter
): void => {
  const schema = PROJECT_APPEARANCE_SPECIFICATION.statements.seed;
  const { automatic, explicit } = schema.forms;
  const [valueField] = schema.order;
  const statementTokens = [keyword, ...values];
  const valueIndex = schema.order.indexOf(valueField) + 1;
  const value = statementTokens[valueIndex];
  let valid = value?.kind === 'word';
  if (!valid) {
    reporter.error(
      'intent.invalid_appearance_seed',
      `Use: seed ${automatic.sentinel}|<${explicit.value.format}>.`,
      value ?? keyword
    );
  }
  const maxLengthKey = explicit.value.maxLength;
  const maxLength = PROJECT_APPEARANCE_SPECIFICATION[maxLengthKey];
  const explicitPattern = new RegExp(explicit.value.pattern);
  if (value?.kind === 'word' && value.value !== automatic.sentinel && (
    !explicitPattern.test(value.value) || value.value.length > maxLength
  )) {
    reporter.error(
      'intent.invalid_appearance_seed',
      `An explicit appearance seed must be ${explicit.value.format} and at most ${maxLength} characters.`,
      value
    );
    valid = false;
  }
  for (const extra of statementTokens.slice(schema.order.length + 1)) {
    reporter.error(
      'intent.unexpected_appearance_seed_value',
      `Unexpected seed value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || value?.kind !== 'word') return;
  if (!intentProgramAllowsOccurrence(
    raw.seed === undefined ? 0 : 1,
    schema.cardinality
  )) {
    reporter.error(
      'intent.duplicate_appearance_seed',
      'appearance seed is declared more than once.',
      value
    );
    return;
  }
  raw.seed = value.value === automatic.sentinel
    ? { kind: automatic.kind }
    : { kind: explicit.kind, value: value.value };
  reporter.field('appearance.seed', value.value, value.span);
  reporter.field('appearance.seed.kind', raw.seed.kind, value.span);
  if (raw.seed.kind === explicit.kind) {
    reporter.field('appearance.seed.value', raw.seed.value, value.span);
  }
};
