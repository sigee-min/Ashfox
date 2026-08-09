import type { IntentProgramToken } from '../lexer';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import {
  isIntentProgramWord,
} from '../syntax';
import type { IntentProgramReadContext } from './contract';
import {
  intentProgramAllowsOccurrence,
  intentProgramCardinalityBounds,
  resolveIntentProgramVocabulary
} from '../schema';
import {
  isIntentProgramVocabularyToken,
  sourceToken,
  sourceTokensFrom,
  sourceTrailingTokens
} from './schema';

const readOrientation = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const schema =
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.orientation;
  const directions = resolveIntentProgramVocabulary(
    schema.fields.forward.enum
  );
  const statementTokens = [keyword, ...values];
  let valid = true;
  const axis = sourceToken(schema.sourceTokens, statementTokens, 'forward');
  const direction = sourceToken(
    schema.sourceTokens,
    statementTokens,
    'direction'
  );
  const axisMarker = schema.sourceTokens[1];
  if (!isIntentProgramWord(axis, axisMarker)) {
    context.error(
      'intent.invalid_orientation_axis',
      'orientation axis must be forward.',
      axis ?? keyword
    );
    valid = false;
  }
  const directionValid = isIntentProgramVocabularyToken(
    direction,
    directions
  );
  if (!directionValid) {
    context.error(
      'intent.invalid_orientation_direction',
      'orientation forward must be north, south, east, or west.',
      direction ?? axis ?? keyword
    );
    valid = false;
  }
  for (const extra of sourceTrailingTokens(
    schema.sourceTokens,
    statementTokens
  )) {
    context.error(
      'intent.unexpected_orientation_value',
      `Unexpected orientation value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || !directionValid) return;
  if (!intentProgramAllowsOccurrence(
    context.raw.model.orientation === undefined ? 0 : 1,
    schema.cardinality
  )) {
    context.error('intent.duplicate_declaration',
      'orientation is declared more than once.', keyword);
    return;
  }
  context.raw.model.orientation = { forward: direction.value };
  context.field('orientation', direction.value, keyword.span);
  context.field('orientation.forward', direction.value, direction.span);
};

const readSymmetry = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const schema =
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.symmetry;
  const symmetries = resolveIntentProgramVocabulary(schema.enum);
  const statementTokens = [keyword, ...values];
  const value = sourceToken(schema.sourceTokens, statementTokens, 'value');
  let valid = isIntentProgramVocabularyToken(
    value,
    symmetries
  );
  if (!valid) {
    context.error('intent.invalid_symmetry',
      'Use: symmetry bilateral|asymmetric.', value ?? keyword);
  }
  for (const extra of sourceTrailingTokens(
    schema.sourceTokens,
    statementTokens
  )) {
    context.error('intent.unexpected_symmetry_value',
      `Unexpected symmetry value "${extra.value}".`, extra);
    valid = false;
  }
  if (!valid || !isIntentProgramVocabularyToken(
    value,
    symmetries
  )) return;
  if (!intentProgramAllowsOccurrence(
    context.raw.model.symmetry === undefined ? 0 : 1,
    schema.cardinality
  )) {
    context.error('intent.duplicate_declaration',
      'symmetry is declared more than once.', keyword);
    return;
  }
  context.raw.model.symmetry = value.value;
  context.field('symmetry', value.value, value.span);
};

const readSupport = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const schema = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.support;
  const supportKinds = resolveIntentProgramVocabulary(schema.fields.kind.enum);
  const contactLayout = schema.sourceTokensByKind.contacts;
  const noneLayout = schema.sourceTokensByKind.none;
  const statementTokens = [keyword, ...values];
  const kind = sourceToken(contactLayout, statementTokens, 'kind');
  const kindValid = isIntentProgramVocabularyToken(
    kind,
    supportKinds
  );
  if (!kindValid) {
    context.error('intent.invalid_support',
      'Use: support none, or support feet|base|wheels contacts <body-id> [...].',
      kind ?? keyword);
  }
  if (kindValid && kind.value === 'none') {
    const extras = sourceTrailingTokens(noneLayout, statementTokens);
    if (extras.length > 0) {
      for (const extra of extras) context.error(
        'intent.unexpected_support_contact',
        'support none accepts no contacts.',
        extra
      );
      return;
    }
    if (!intentProgramAllowsOccurrence(
      context.raw.model.support === undefined ? 0 : 1,
      schema.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'support is declared more than once.', keyword);
      return;
    }
    context.raw.model.support = { kind: 'none', contacts: [] };
    context.field('support', 'none', kind.span);
    context.field('support.kind', 'none', kind.span);
    context.span('support.contacts', kind.span);
    return;
  }
  if (!kindValid && statementTokens.length <= noneLayout.length) return;
  let valid = kindValid;
  const marker = sourceToken(contactLayout, statementTokens, 'contacts');
  context.span('support.contacts', marker?.span ?? kind?.span ?? keyword.span);
  if (!isIntentProgramWord(marker, contactLayout[2])) {
    context.error('intent.invalid_support',
      'Use: support feet|base|wheels contacts <body-id> [...].',
      marker ?? kind);
    valid = false;
  }
  const contactTokens = sourceTokensFrom(
    contactLayout,
    statementTokens,
    'contactIds'
  );
  const contactCardinality = kindValid
    ? schema.fields.contacts.cardinalityByKind[kind.value]
    : { min: 1, max: null };
  const contactBounds = intentProgramCardinalityBounds(contactCardinality);
  if (contactTokens.length < contactBounds.min) {
    context.error(
      'intent.missing_support_contact',
      `${kind?.value ?? 'Contact'} support requires at least one contact body ID.`,
      marker ?? kind
    );
    valid = false;
  }
  if (contactBounds.max !== null &&
    contactTokens.length > contactBounds.max) {
    context.error(
      'intent.invalid_support_cardinality',
      `${kind?.value ?? 'Contact'} support accepts at most ${contactBounds.max} contact body ID.`,
      contactTokens[contactBounds.max] ?? marker ?? kind
    );
    valid = false;
  }
  const contacts: string[] = [];
  for (const token of contactTokens) {
    const id = context.identifier(token, 'a support contact body ID');
    if (!id) valid = false;
    else contacts.push(id);
  }
  if (!valid) return;
  if (!kindValid) return;
  if (!intentProgramAllowsOccurrence(
    context.raw.model.support === undefined ? 0 : 1,
    schema.cardinality
  )) {
    context.error('intent.duplicate_declaration',
      'support is declared more than once.', keyword);
    return;
  }
  context.raw.model.support = { kind: kind.value, contacts };
  context.field('support', kind.value, kind.span);
  context.field('support.kind', kind.value, kind.span);
  contacts.forEach((contact, index) => {
    context.field(`support.contacts.${index}`, contact, contactTokens[index]!.span);
    context.field(`support.contacts.${contact}`, contact,
      contactTokens[index]!.span);
  });
};

const readFocal = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const schema = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.focal;
  const statementTokens = [keyword, ...values];
  const idToken = sourceToken(schema.sourceTokens, statementTokens, 'id');
  const parentMarker = sourceToken(
    schema.sourceTokens,
    statementTokens,
    'parent'
  );
  const parentToken = sourceToken(
    schema.sourceTokens,
    statementTokens,
    'parentId'
  );
  let valid = true;
  const id = context.identifier(idToken, 'a focal ID');
  if (!id) valid = false;
  if (!isIntentProgramWord(parentMarker, schema.sourceTokens[2])) {
    context.error('intent.invalid_focal',
      'Use: focal <id> parent <body-id>.', parentMarker ?? keyword);
    valid = false;
  }
  const parent = context.identifier(parentToken, 'a focal parent body ID');
  if (!parent) valid = false;
  for (const extra of sourceTrailingTokens(
    schema.sourceTokens,
    statementTokens
  )) {
    context.error(
      'intent.unexpected_focal_value',
      `Unexpected focal value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || !id || !parent || !idToken || !parentToken) return;
  if (!intentProgramAllowsOccurrence(
    context.raw.model.focal === undefined ? 0 : 1,
    schema.cardinality
  )) {
    context.error('intent.duplicate_declaration',
      'focal is declared more than once.', keyword);
    return;
  }
  context.raw.model.focal = { id, parent };
  context.field('focal', id, idToken.span);
  context.field('focal.id', id, idToken.span);
  context.field('focal.parent', parent, parentToken.span);
};

export const readModelStatement = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const statements = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model;
  const orientationKeyword = statements.orientation.sourceTokens[0];
  const symmetryKeyword = statements.symmetry.sourceTokens[0];
  const supportKeyword = statements.support.sourceTokensByKind.none[0];
  const focalKeyword = statements.focal.sourceTokens[0];
  if (keyword.value === orientationKeyword) {
    readOrientation(context, keyword, values);
  } else if (keyword.value === symmetryKeyword) {
    readSymmetry(context, keyword, values);
  } else if (keyword.value === supportKeyword) {
    readSupport(context, keyword, values);
  } else if (keyword.value === focalKeyword) {
    readFocal(context, keyword, values);
  } else {
    context.error('intent.wrong_authority',
      `Statement "${keyword.value}" does not belong directly in model.`,
      keyword);
  }
};
