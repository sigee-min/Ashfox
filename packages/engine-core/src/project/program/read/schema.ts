import type { IntentProgramToken } from '../lexer';

export const isIntentProgramVocabularyToken = <TValue extends string>(
  token: IntentProgramToken | undefined,
  vocabulary: readonly TValue[]
): token is IntentProgramToken & { readonly kind: 'word'; readonly value: TValue } =>
  token?.kind === 'word' && vocabulary.some((entry) => entry === token.value);

type SourceTokenName<TSourceTokens extends readonly string[]> =
  TSourceTokens[number];

/** Resolves one token exclusively through its executable statement layout. */
export const sourceToken = <TSourceTokens extends readonly string[]>(
  sourceTokens: TSourceTokens,
  statementTokens: readonly IntentProgramToken[],
  name: SourceTokenName<TSourceTokens>
): IntentProgramToken | undefined => {
  const index = sourceTokens.indexOf(name);
  return index < 0 ? undefined : statementTokens[index];
};

/** Returns the variadic field beginning at `name`, including every value. */
export const sourceTokensFrom = <TSourceTokens extends readonly string[]>(
  sourceTokens: TSourceTokens,
  statementTokens: readonly IntentProgramToken[],
  name: SourceTokenName<TSourceTokens>
): readonly IntentProgramToken[] => {
  const index = sourceTokens.indexOf(name);
  return index < 0 ? [] : statementTokens.slice(index);
};

/** Returns values beyond the closed arity declared by `sourceTokens`. */
export const sourceTrailingTokens = (
  sourceTokens: readonly string[],
  statementTokens: readonly IntentProgramToken[]
): readonly IntentProgramToken[] => statementTokens.slice(sourceTokens.length);
