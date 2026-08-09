import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import type { IntentProgramToken } from '../lexer';
import {
  isIntentProgramWord,
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

const faceSchema =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.face;
const faceLayouts = faceSchema.sourceTokensByProperty;
const faceKinds = resolveIntentProgramVocabulary(faceSchema.fields.kind.enum);
const eyeConfigurations = resolveIntentProgramVocabulary(
  faceSchema.fields.eyes.enum
);
const gazeModes = resolveIntentProgramVocabulary(faceSchema.fields.gaze.enum);
const noseModes = resolveIntentProgramVocabulary(faceSchema.fields.nose.enum);
const mouthModes = resolveIntentProgramVocabulary(faceSchema.fields.mouth.enum);

export const isFaceBlockKeyword = (token: IntentProgramToken): boolean =>
  token.kind === 'word' &&
  Object.prototype.hasOwnProperty.call(faceLayouts, token.value);

export const invalidFaceBlockMessage =
  `A face block contains ${Object.keys(faceLayouts).join(', ')} declarations.`;

export const readFaceSourceStatement = (
  context: IntentProgramReadContext,
  values: readonly IntentProgramToken[]
): void => {
  const draft = context.raw.model.face ?? {};
  if (!intentProgramAllowsOccurrence(
    draft.kind === undefined ? 0 : 1,
    faceSchema.cardinality
  )) {
    context.error('intent.duplicate_declaration',
      'face kind is declared more than once.', values[0] ?? context.current());
    return;
  }
  const noneLayout = faceLayouts.none;
  const fullLayout = faceLayouts.full;
  const kind = sourceToken(fullLayout, values, 'full');
  if (isIntentProgramVocabularyToken(kind, faceKinds) &&
    kind.value === noneLayout[0]) {
    let valid = true;
    for (const extra of sourceTrailingTokens(noneLayout, values)) {
      context.error(
        'intent.unexpected_face_value',
        `Unexpected face value "${extra.value}".`,
        extra
      );
      valid = false;
    }
    if (draft.parent || draft.eyes || draft.gaze || draft.nose || draft.mouth) {
      context.error('intent.invalid_face_property',
        'face none cannot own full-face properties.', kind);
      valid = false;
    }
    if (!valid) return;
    context.raw.model.face = { ...draft, kind: 'none' };
    context.field('face', 'none', kind.span);
    context.field('face.kind', 'none', kind.span);
    return;
  }
  let valid = true;
  const parentMarker = sourceToken(fullLayout, values, 'parent');
  const parentToken = sourceToken(fullLayout, values, 'parentId');
  if (!isIntentProgramVocabularyToken(kind, faceKinds) ||
    kind.value !== fullLayout[0]) {
    context.error('intent.invalid_face',
      'Face kind must be none or full.', kind ?? context.current());
    valid = false;
  }
  if (!isIntentProgramWord(parentMarker, fullLayout[1])) {
    context.error(
      'intent.invalid_face_parent_marker',
      'A full face uses parent <body-id>.',
      parentMarker ?? kind ?? context.current()
    );
    valid = false;
  }
  const parent = context.identifier(
    parentToken,
    'a face parent body ID',
    'intent.missing_face_parent'
  );
  if (!parent) valid = false;
  for (const extra of sourceTrailingTokens(fullLayout, values)) {
    context.error(
      'intent.unexpected_face_value',
      `Unexpected face value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || !parent || !parentToken || !kind) return;
  context.raw.model.face = { ...draft, kind: 'full', parent };
  context.field('face', 'full', kind.span);
  context.field('face.kind', 'full', kind.span);
  context.field('face.parent', parent, parentToken.span);
};

export const readFacePropertySourceStatement = (
  context: IntentProgramReadContext,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): void => {
  const face = context.raw.model.face ?? {};
  const statementTokens = [keyword, ...values];
  if (face.kind === 'none') {
    context.error('intent.invalid_face_property',
      'face none cannot own full-face properties.', keyword);
    return;
  }
  if (keyword.value === faceLayouts.eyes[0]) {
    const layout = faceLayouts.eyes;
    const configuration = sourceToken(
      layout,
      statementTokens,
      'configuration'
    );
    const gazeMarker = sourceToken(layout, statementTokens, 'gaze');
    const gaze = sourceToken(layout, statementTokens, 'gazeMode');
    let valid = true;
    if (!isIntentProgramVocabularyToken(
      configuration,
      eyeConfigurations
    )) {
      context.error(
        'intent.invalid_eye_configuration',
        'eyes configuration must be single or paired.',
        configuration ?? keyword
      );
      valid = false;
    }
    if (!isIntentProgramWord(gazeMarker, layout[2])) {
      context.error(
        'intent.invalid_gaze_marker',
        'eyes configuration must be followed by gaze.',
        gazeMarker ?? configuration ?? keyword
      );
      valid = false;
    }
    if (!isIntentProgramVocabularyToken(
      gaze,
      gazeModes
    )) {
      context.error(
        'intent.invalid_gaze',
        'gaze must be center.',
        gaze ?? gazeMarker ?? keyword
      );
      valid = false;
    }
    for (const extra of sourceTrailingTokens(layout, statementTokens)) {
      context.error(
        'intent.unexpected_eyes_value',
        `Unexpected eyes value "${extra.value}".`,
        extra
      );
      valid = false;
    }
    if (!valid || !isIntentProgramVocabularyToken(
      configuration,
      eyeConfigurations
    ) || !isIntentProgramVocabularyToken(
      gaze,
      gazeModes
    )) return;
    if (!intentProgramAllowsOccurrence(
      face.eyes === undefined ? 0 : 1,
      faceSchema.fields.eyes.cardinality
    ) || !intentProgramAllowsOccurrence(
      face.gaze === undefined ? 0 : 1,
      faceSchema.fields.gaze.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'eyes is declared more than once.', keyword);
      return;
    }
    context.raw.model.face = { ...face, eyes: configuration.value, gaze: gaze.value };
    context.field('face.eyes', configuration.value, configuration.span);
    context.field('face.gaze', gaze.value, gaze.span);
    return;
  }
  if (keyword.value === faceLayouts.nose[0]) {
    const layout = faceLayouts.nose;
    const value = sourceToken(layout, statementTokens, 'mode');
    let valid = isIntentProgramVocabularyToken(
      value,
      noseModes
    );
    if (!valid) {
      context.error('intent.invalid_nose', 'Use: nose present|absent.',
        value ?? keyword);
    }
    for (const extra of sourceTrailingTokens(layout, statementTokens)) {
      context.error('intent.unexpected_nose_value',
        `Unexpected nose value "${extra.value}".`, extra);
      valid = false;
    }
    if (!valid || !isIntentProgramVocabularyToken(
      value,
      noseModes
    )) return;
    if (!intentProgramAllowsOccurrence(
      face.nose === undefined ? 0 : 1,
      faceSchema.fields.nose.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'nose is declared more than once.', keyword);
      return;
    }
    context.raw.model.face = { ...face, nose: value.value };
    context.field('face.nose', value.value, value.span);
    return;
  }
  if (keyword.value === faceLayouts.mouth[0]) {
    const layout = faceLayouts.mouth;
    const value = sourceToken(layout, statementTokens, 'mode');
    let valid = isIntentProgramVocabularyToken(
      value,
      mouthModes
    );
    if (!valid) {
      context.error('intent.invalid_mouth',
        'Use: mouth absent|neutral|beak|fang.',
        value ?? keyword);
    }
    for (const extra of sourceTrailingTokens(layout, statementTokens)) {
      context.error('intent.unexpected_mouth_value',
        `Unexpected mouth value "${extra.value}".`, extra);
      valid = false;
    }
    if (!valid || !isIntentProgramVocabularyToken(
      value,
      mouthModes
    )) return;
    if (!intentProgramAllowsOccurrence(
      face.mouth === undefined ? 0 : 1,
      faceSchema.fields.mouth.cardinality
    )) {
      context.error('intent.duplicate_declaration',
        'mouth is declared more than once.', keyword);
      return;
    }
    context.raw.model.face = { ...face, mouth: value.value };
    context.field('face.mouth', value.value, value.span);
    return;
  }
  context.error('intent.invalid_face_property', invalidFaceBlockMessage, keyword);
};
