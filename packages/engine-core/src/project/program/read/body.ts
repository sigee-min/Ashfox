import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import type { IntentProgramToken } from '../lexer';
import {
  identifierPattern,
  isIntentProgramWord,
  type IntentProgramWordToken
} from '../syntax';
import type { IntentProgramModuleKind } from '../types';
import type { IntentProgramReadContext } from './contract';
import { resolveIntentProgramVocabulary } from '../schema';
import {
  isIntentProgramVocabularyToken,
  sourceToken,
  sourceTrailingTokens
} from './schema';

const bodySchema = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.body;
const moduleKinds = resolveIntentProgramVocabulary(bodySchema.fields.kind.enum);
const cardinalities = resolveIntentProgramVocabulary(
  bodySchema.fields.cardinality.enum
);
const anchors = resolveIntentProgramVocabulary(bodySchema.fields.anchor.enum);
const growthDirections = resolveIntentProgramVocabulary(
  bodySchema.fields.growth.enum
);
const lanes = resolveIntentProgramVocabulary(bodySchema.fields.lane.enum);

export const isBodySourceKind = (
  token: IntentProgramToken
): token is IntentProgramWordToken<IntentProgramModuleKind> =>
  isIntentProgramVocabularyToken(token, moduleKinds);

export const invalidBodyBlockMessage =
  `A body block contains only ${[
    ...moduleKinds
  ].join(', ')} declarations.`;

export const readBodyModuleSourceStatement = (
  context: IntentProgramReadContext,
  kindToken: IntentProgramWordToken<IntentProgramModuleKind>,
  values: readonly IntentProgramToken[]
): void => {
  const kind = kindToken.value;
  const statementTokens = [kindToken, ...values];
  const attachedTokens = bodySchema.sourceTokensByKind.attached;
  const coreTokens = bodySchema.sourceTokensByKind.core;
  const requiresCardinality =
    bodySchema.fields.cardinality.requiredByKind[kind];
  const [
    , , , parentMarker, , anchorMarker, , growthMarker, , laneMarker
  ] = attachedTokens;
  const idToken = sourceToken(
    requiresCardinality ? attachedTokens : coreTokens,
    statementTokens,
    'id'
  );
  const id = context.identifier(
    idToken,
    `${kind} body ID`,
    'intent.missing_module_id'
  );
  if (kind === 'core') {
    if (!id || !idToken) return;
    if (context.raw.model.body.some((entry) => entry.id === id)) {
      context.error('intent.duplicate_module',
        `Module "${id}" is declared more than once.`, idToken);
      return;
    }
    const extras = sourceTrailingTokens(coreTokens, statementTokens);
    if (extras.length > 0) {
      context.error('intent.invalid_core', 'Use: core <id>.',
        extras[0] ?? idToken);
      return;
    }
    context.raw.model.body.push({ id, kind: 'core', cardinality: 'single' });
    context.field(`body.${id}`, id, idToken.span);
    context.field(`body.${id}.id`, id, idToken.span);
    context.field(`body.${id}.kind`, kind, kindToken.span);
    context.span(`body.${id}.cardinality`, idToken.span);
    return;
  }

  let valid = Boolean(id && idToken);
  const report = (message: string, token?: IntentProgramToken): void => {
    valid = false;
    context.error('intent.invalid_body_relation', message,
      token ?? idToken ?? kindToken);
  };
  const cardinalityToken = sourceToken(
    attachedTokens, statementTokens, 'cardinality'
  );
  const parentKeyword = sourceToken(attachedTokens, statementTokens, 'parent');
  const parentToken = sourceToken(attachedTokens, statementTokens, 'parentId');
  const anchorKeyword = sourceToken(attachedTokens, statementTokens, 'anchor');
  const anchorToken = sourceToken(
    attachedTokens, statementTokens, 'anchorValue'
  );
  const growthKeyword = sourceToken(attachedTokens, statementTokens, 'growth');
  const growthToken = sourceToken(
    attachedTokens, statementTokens, 'growthValue'
  );
  const laneKeyword = sourceToken(attachedTokens, statementTokens, 'lane');
  const laneToken = sourceToken(attachedTokens, statementTokens, 'laneValue');

  const cardinality = isIntentProgramVocabularyToken(
    cardinalityToken,
    cardinalities
  ) ? cardinalityToken.value : null;
  if (!cardinality) report('Body cardinality must be single or paired.',
    cardinalityToken);
  if (!isIntentProgramWord(parentKeyword, parentMarker)) {
    report('Expected "parent" before the body parent ID.', parentKeyword);
  }
  const parent = parentToken?.kind === 'word' &&
    identifierPattern.test(parentToken.value)
    ? parentToken.value
    : null;
  if (!parent) report('Body parent must be a lower-kebab-case ID.', parentToken);
  if (!isIntentProgramWord(anchorKeyword, anchorMarker)) {
    report('Expected "anchor" before the body anchor.', anchorKeyword);
  }
  const anchor = isIntentProgramVocabularyToken(
    anchorToken,
    anchors
  ) ? anchorToken.value : null;
  if (!anchor) report(
    `Body anchor must be one of: ${
      anchors.join(', ')
    }.`, anchorToken);
  if (!isIntentProgramWord(growthKeyword, growthMarker)) {
    report('Expected "growth" before the body growth direction.', growthKeyword);
  }
  const growth = isIntentProgramVocabularyToken(
    growthToken,
    growthDirections
  ) ? growthToken.value : null;
  if (!growth) report(
    `Body growth must be one of: ${
      growthDirections.join(', ')
    }.`, growthToken);
  if (!isIntentProgramWord(laneKeyword, laneMarker)) {
    report('Expected "lane" before the body attachment lane.', laneKeyword);
  }
  const lane = isIntentProgramVocabularyToken(
    laneToken,
    lanes
  ) ? laneToken.value : null;
  if (!lane) report(
    `Body lane must be one of: ${
      lanes.join(', ')
    }.`, laneToken);
  const extras = sourceTrailingTokens(attachedTokens, statementTokens);
  if (extras.length > 0) {
    report('Body attachment has unexpected trailing values.',
      extras[0]);
  }
  if (id && idToken && context.raw.model.body.some((entry) => entry.id === id)) {
    valid = false;
    context.error('intent.duplicate_module',
      `Module "${id}" is declared more than once.`, idToken);
  }
  if (!valid || !id || !idToken || !cardinality || !cardinalityToken ||
    !parent || !parentToken || !anchor || !anchorToken || !growth ||
    !growthToken || !lane || !laneToken) {
    return;
  }
  context.raw.model.body.push({
    id,
    kind,
    cardinality,
    parent,
    anchor,
    growth,
    lane
  });
  context.field(`body.${id}`, id, idToken.span);
  context.field(`body.${id}.id`, id, idToken.span);
  context.field(`body.${id}.kind`, kind, kindToken.span);
  context.field(`body.${id}.cardinality`, cardinality,
    cardinalityToken.span);
  context.field(`body.${id}.parent`, parent, parentToken.span);
  context.field(`body.${id}.anchor`, anchor, anchorToken.span);
  context.field(`body.${id}.growth`, growth, growthToken.span);
  context.field(`body.${id}.lane`, lane, laneToken.span);
};
