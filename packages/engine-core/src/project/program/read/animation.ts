import type { IntentProgramToken } from '../lexer';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import {
  isIntentProgramWord
} from '../syntax';
import type { IntentProgramReadContext } from './contract';
import {
  intentProgramAllowsOccurrence,
  resolveIntentProgramVocabulary
} from '../schema';
import {
  isIntentProgramVocabularyToken,
  sourceToken,
  sourceTrailingTokens
} from './schema';

export const readAnimationStatement = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const schema = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.animation.idle;
  const idleModes = resolveIntentProgramVocabulary(schema.fields.mode.enum);
  const absentLayout = schema.sourceTokensByTarget.absent;
  const presentLayout = schema.sourceTokensByTarget.present;
  if (keyword.value !== absentLayout[0]) {
    context.error('intent.wrong_authority',
      `Statement "${keyword.value}" does not belong in animation.`, keyword);
    return;
  }
  const statementTokens = [keyword, ...values];
  const mode = sourceToken(absentLayout, statementTokens, 'mode');
  let valid = true;
  const modeValid = isIntentProgramVocabularyToken(
    mode,
    idleModes
  );
  if (!modeValid) {
    context.error('intent.invalid_idle',
      'idle mode must be still, breathe, or scan.', mode ?? keyword);
    valid = false;
  }
  if (!intentProgramAllowsOccurrence(
    context.raw.animation.idle === undefined ? 0 : 1,
    schema.cardinality
  )) {
    context.error('intent.duplicate_declaration',
      'idle is declared more than once.', keyword);
    return;
  }
  const hasTargetFields = statementTokens.length > absentLayout.length;
  const targetMarker = hasTargetFields
    ? sourceToken(presentLayout, statementTokens, 'target')
    : undefined;
  if (hasTargetFields && !isIntentProgramWord(
    targetMarker,
    presentLayout[2]
  )) {
    context.error(
      'intent.invalid_idle_target_marker',
      'An idle target uses target <body-id>.',
      targetMarker ?? mode ?? keyword
    );
    valid = false;
  }
  const targetToken = hasTargetFields
    ? sourceToken(presentLayout, statementTokens, 'targetId')
    : undefined;
  const target = targetToken
    ? context.identifier(targetToken, 'an idle target body ID')
    : undefined;
  if (hasTargetFields && !targetToken) {
    context.error(
      'intent.missing_idle_target',
      'An idle target requires one body ID.',
      targetMarker ?? mode ?? keyword
    );
    valid = false;
  }
  if (targetToken && !target) valid = false;
  const activeLayout = hasTargetFields ? presentLayout : absentLayout;
  for (const extra of sourceTrailingTokens(activeLayout, statementTokens)) {
    context.error(
      'intent.unexpected_idle_value',
      `Unexpected idle value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || !modeValid || !mode) return;
  context.raw.animation.idle = {
    mode: mode.value,
    ...(target ? { target } : {})
  };
  context.field('animation.idle', mode.value, keyword.span);
  context.field('animation.idle.mode', mode.value, mode.span);
  if (target && targetToken) {
    context.field('animation.idle.target', target, targetToken.span);
  }
};
