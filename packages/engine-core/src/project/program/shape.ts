import type { IntentProgramToken } from './lexer';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from './language';
import {
  identifierPattern,
  type RawIntentProgram
} from './syntax';
import {
  intentProgramAllowsOccurrence,
  resolveIntentProgramVocabulary
} from './schema';
import { isIntentProgramVocabularyToken } from './read/schema';
import type {
  IntentProgramSpan,
  IntentProgramSurfaceShape
} from './types';

export interface SurfaceShapeSourceReporter {
  error(code: string, message: string, token?: IntentProgramToken): void;
  field(path: string, value: string, span: IntentProgramSpan): void;
}

type ShapeField = keyof IntentProgramSurfaceShape;

const shapeStatement =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.shape;
const shapeVocabulary = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.surfaceShapes;
const shapeFields = Object.freeze(
  Object.keys(shapeStatement.fields)
) as readonly ShapeField[];
const requiredShapeFields = shapeFields.filter(
  (field) => shapeStatement.fields[field].required
);

const vocabulary = (field: ShapeField): readonly string[] =>
  resolveIntentProgramVocabulary(shapeStatement.fields[field].enum);

const isShapeValue = <Values extends readonly string[]>(
  value: string | undefined,
  values: Values
): value is Values[number] =>
  value !== undefined && values.some((candidate) => candidate === value);

export interface SurfaceShapeDraft {
  readonly surfaceId: string;
  readonly idToken: IntentProgramToken;
  readonly values: Partial<Record<ShapeField, string>>;
}

export const createSurfaceShapeDraft = (
  raw: RawIntentProgram,
  idToken: IntentProgramToken | undefined,
  reporter: SurfaceShapeSourceReporter
): SurfaceShapeDraft | null => {
  if (!idToken) {
    reporter.error('intent.missing_surface_shape_id',
      'Expected a shaped surface ID.');
    return null;
  }
  if (idToken.kind !== 'word' || !identifierPattern.test(idToken.value)) {
    reporter.error('intent.invalid_identifier',
      'A shaped surface ID must be lower-kebab-case.', idToken);
    return null;
  }
  const existingCount = shapeStatement.cardinality.per === 'surface'
    ? raw.model.surfaceShapes.filter((entry) =>
        entry.surfaceId === idToken.value
      ).length
    : raw.model.surfaceShapes.length;
  if (!intentProgramAllowsOccurrence(
    existingCount,
    shapeStatement.cardinality
  )) {
    reporter.error('intent.duplicate_surface_shape',
      `Shape for surface "${idToken.value}" is declared more than once.`,
      idToken);
    return null;
  }
  reporter.field(`surfaces.${idToken.value}.shape`, idToken.value, idToken.span);
  return { surfaceId: idToken.value, idToken, values: {} };
};

export const readSurfaceShapeProperty = (
  draft: SurfaceShapeDraft,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[],
  reporter: SurfaceShapeSourceReporter
): void => {
  if (!shapeFields.includes(keyword.value as ShapeField)) {
    reporter.error('intent.unknown_surface_shape_property',
      `Unknown shape property "${keyword.value}".`, keyword);
    return;
  }
  const field = keyword.value as ShapeField;
  const value = values[0];
  let valid = isIntentProgramVocabularyToken(value, vocabulary(field));
  if (!valid) {
    reporter.error('intent.invalid_surface_shape_property',
      `Shape ${field} must be one of: ${vocabulary(field).join(', ')}.`,
      value ?? keyword);
  }
  for (const extra of values.slice(1)) {
    reporter.error(
      'intent.unexpected_surface_shape_value',
      `Unexpected shape ${field} value "${extra.value}".`,
      extra
    );
    valid = false;
  }
  if (!valid || !isIntentProgramVocabularyToken(value, vocabulary(field))) return;
  if (!intentProgramAllowsOccurrence(
    draft.values[field] === undefined ? 0 : 1,
    shapeStatement.fields[field].cardinality
  )) {
    reporter.error('intent.duplicate_surface_shape_property',
      `Shape ${field} is declared more than once.`, keyword);
    return;
  }
  draft.values[field] = value.value;
  reporter.field(
    `surfaces.${draft.surfaceId}.shape.${field}`,
    value.value,
    value.span
  );
};

export const completeSurfaceShape = (
  raw: RawIntentProgram,
  draft: SurfaceShapeDraft,
  reporter: SurfaceShapeSourceReporter
): void => {
  const missing = requiredShapeFields.filter((field) =>
    draft.values[field] === undefined
  );
  for (const field of missing) {
    reporter.error('intent.missing_surface_shape_property',
      `Shape for surface "${draft.surfaceId}" requires ${field}.`,
      draft.idToken);
  }
  if (missing.length > 0) return;
  const { axis, span, chord, tip, offset, edge } = draft.values;
  if (!isShapeValue(axis, shapeVocabulary.axis) ||
    !isShapeValue(span, shapeVocabulary.span) ||
    !isShapeValue(chord, shapeVocabulary.chord) ||
    !isShapeValue(tip, shapeVocabulary.tip) ||
    !isShapeValue(offset, shapeVocabulary.offset) ||
    !isShapeValue(edge, shapeVocabulary.edge)) return;
  raw.model.surfaceShapes.push({
    surfaceId: draft.surfaceId,
    shape: { axis, span, chord, tip, offset, edge }
  });
};
