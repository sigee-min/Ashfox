import type { IntentProgramToken } from '../program/lexer';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../program/language';
import type { RawIntentProgramAppearance } from '../program/syntax';
import type { AppearanceSourceReporter } from './source/contract';
import { readMarkSource } from './source/mark';
import { readPaletteSource, readSeedSource } from './source/scalar';
import { readTextureSource } from './source/texture';

export type { AppearanceSourceReporter } from './source/contract';

export const readAppearanceSourceStatement = (
  raw: RawIntentProgramAppearance,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[],
  reporter: AppearanceSourceReporter
): void => {
  const languageStatements =
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.appearance;
  const textureSchema = languageStatements.texture.schema;
  const seedSchema = languageStatements.seed.schema;
  const markSchema = languageStatements.mark.schema;
  const paletteKeyword = languageStatements.palette.sourceTokens[0];
  const allowed = [
    paletteKeyword,
    textureSchema.keyword,
    seedSchema.keyword,
    markSchema.keyword
  ] as const;
  if (keyword.kind !== 'word') {
    reporter.error(
      'intent.invalid_appearance_statement',
      `An appearance block contains only ${allowed.join(', ')} declarations.`,
      keyword
    );
    return;
  }
  if (keyword.value === paletteKeyword) {
    readPaletteSource(raw, keyword, values, reporter);
  } else if (keyword.value === textureSchema.keyword) {
    readTextureSource(raw, keyword, values, reporter);
  } else if (keyword.value === seedSchema.keyword) {
    readSeedSource(raw, keyword, values, reporter);
  } else if (keyword.value === markSchema.keyword) {
    readMarkSource(raw, keyword, values, reporter);
  } else {
    reporter.error(
      'intent.invalid_appearance_statement',
      `An appearance block contains only ${allowed.join(', ')} declarations.`,
      keyword
    );
  }
};
