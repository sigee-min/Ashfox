import type { IntentProgramToken } from '../lexer';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import {
  identifierPattern,
  isIntentProgramWord,
} from '../syntax';
import type { IntentProgramReadContext } from './contract';
import { resolveIntentProgramVocabulary } from '../schema';
import {
  isIntentProgramVocabularyToken,
  sourceToken,
  sourceTrailingTokens
} from './schema';

const surfaceSchema =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.surface;
const surfaceTokens = surfaceSchema.sourceTokens;
const cardinalities = resolveIntentProgramVocabulary(
  surfaceSchema.fields.cardinality.enum
);
const roles = resolveIntentProgramVocabulary(surfaceSchema.fields.role.enum);
const anchors = resolveIntentProgramVocabulary(surfaceSchema.fields.anchor.enum);
const growthDirections = resolveIntentProgramVocabulary(
  surfaceSchema.fields.growth.enum
);
const lanes = resolveIntentProgramVocabulary(surfaceSchema.fields.lane.enum);

export const readSurfaceSourceStatement = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const statementTokens = [keyword, ...values];
  const [
    , , , , parentMarker, , anchorMarker, , growthMarker, , laneMarker
  ] = surfaceTokens;
  const idToken = sourceToken(surfaceTokens, statementTokens, 'id');
  const cardinalityToken = sourceToken(
    surfaceTokens, statementTokens, 'cardinality'
  );
  const roleToken = sourceToken(surfaceTokens, statementTokens, 'role');
  const parentKeyword = sourceToken(surfaceTokens, statementTokens, 'parent');
  const parentToken = sourceToken(surfaceTokens, statementTokens, 'parentId');
  const anchorKeyword = sourceToken(surfaceTokens, statementTokens, 'anchor');
  const anchorToken = sourceToken(
    surfaceTokens, statementTokens, 'anchorValue'
  );
  const growthKeyword = sourceToken(surfaceTokens, statementTokens, 'growth');
  const growthToken = sourceToken(
    surfaceTokens, statementTokens, 'growthValue'
  );
  const laneKeyword = sourceToken(surfaceTokens, statementTokens, 'lane');
  const laneToken = sourceToken(surfaceTokens, statementTokens, 'laneValue');
  const id = context.identifier(
    idToken,
    'a surface ID',
    'intent.missing_surface_id'
  );
  let valid = Boolean(id && idToken);
  const report = (message: string, token?: IntentProgramToken): void => {
    valid = false;
    context.error('intent.invalid_surface', message,
      token ?? idToken ?? context.current());
  };
  const cardinality = isIntentProgramVocabularyToken(
    cardinalityToken,
    cardinalities
  ) ? cardinalityToken.value : null;
  if (!cardinality) report('Surface cardinality must be single or paired.',
    cardinalityToken);
  const role = isIntentProgramVocabularyToken(
    roleToken,
    roles
  ) ? roleToken.value : null;
  if (!role) report(
    `Surface role must be one of: ${
      roles.join(', ')
    }.`, roleToken);
  if (!isIntentProgramWord(parentKeyword, parentMarker)) {
    report('Expected "parent" before the surface parent ID.', parentKeyword);
  }
  const parent = parentToken?.kind === 'word' &&
    identifierPattern.test(parentToken.value)
    ? parentToken.value
    : null;
  if (!parent) report('Surface parent must be a lower-kebab-case ID.', parentToken);
  if (!isIntentProgramWord(anchorKeyword, anchorMarker)) {
    report('Expected "anchor" before the surface anchor.', anchorKeyword);
  }
  const anchor = isIntentProgramVocabularyToken(
    anchorToken,
    anchors
  ) ? anchorToken.value : null;
  if (!anchor) report(
    `Surface anchor must be one of: ${
      anchors.join(', ')
    }.`, anchorToken);
  if (!isIntentProgramWord(growthKeyword, growthMarker)) {
    report('Expected "growth" before the surface growth direction.', growthKeyword);
  }
  const growth = isIntentProgramVocabularyToken(
    growthToken,
    growthDirections
  ) ? growthToken.value : null;
  if (!growth) report(
    `Surface growth must be one of: ${
      growthDirections.join(', ')
    }.`, growthToken);
  if (!isIntentProgramWord(laneKeyword, laneMarker)) {
    report('Expected "lane" before the surface attachment lane.', laneKeyword);
  }
  const lane = isIntentProgramVocabularyToken(
    laneToken,
    lanes
  ) ? laneToken.value : null;
  if (!lane) report(
    `Surface lane must be one of: ${
      lanes.join(', ')
    }.`, laneToken);
  const extras = sourceTrailingTokens(surfaceTokens, statementTokens);
  if (extras.length > 0) {
    report('Surface declaration has unexpected trailing values.',
      extras[0]);
  }
  if (id && idToken && context.raw.model.surfaces.some(
    (surface) => surface.id === id
  )) {
    valid = false;
    context.error('intent.duplicate_surface',
      `Surface "${id}" is declared more than once.`, idToken);
  }
  if (!valid || !id || !idToken || !cardinality || !cardinalityToken ||
    !role || !roleToken || !parent || !parentToken || !anchor ||
    !anchorToken || !growth || !growthToken || !lane || !laneToken) return;
  context.raw.model.surfaces.push({
    id,
    cardinality,
    role,
    parent,
    anchor,
    growth,
    lane
  });
  context.field(`surfaces.${id}`, id, idToken.span);
  context.field(`surfaces.${id}.id`, id, idToken.span);
  context.field(`surfaces.${id}.cardinality`, cardinality,
    cardinalityToken.span);
  context.field(`surfaces.${id}.role`, role, roleToken.span);
  context.field(`surfaces.${id}.parent`, parent, parentToken.span);
  context.field(`surfaces.${id}.anchor`, anchor, anchorToken.span);
  context.field(`surfaces.${id}.growth`, growth, growthToken.span);
  context.field(`surfaces.${id}.lane`, lane, laneToken.span);
};
