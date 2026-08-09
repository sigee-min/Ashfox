import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from './language';

export type IntentProgramSourceCardinality =
  | number
  | 'exactly-one'
  | { readonly min: number; readonly max: number | null };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

type EnumPointer<TValue> = TValue extends { readonly enum: infer TPointer }
  ? TPointer extends string ? TPointer : never
  : TValue extends readonly unknown[] ? never
    : TValue extends object ? EnumPointer<TValue[keyof TValue]> : never;

type IntentProgramVocabularyPointer =
  | EnumPointer<typeof INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements>
  | typeof INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.root.allowed
  | typeof INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.root.required;

type SpecificationPathValue<
  TValue,
  TPath extends string
> = TPath extends `${infer THead}.${infer TTail}`
  ? THead extends keyof TValue
    ? SpecificationPathValue<TValue[THead], TTail>
    : never
  : TPath extends keyof TValue ? TValue[TPath] : never;

type IntentProgramVocabularyAt<TPointer extends string> = Extract<
  SpecificationPathValue<
    typeof INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
    TPointer
  >,
  readonly string[]
>;

/** Resolves a descriptor pointer against the one frozen language authority. */
export const resolveIntentProgramSpecificationPointer = (
  pointer: string
): unknown => {
  let value: unknown = INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
  for (const segment of pointer.split('.')) {
    if (!isRecord(value) || !(segment in value)) {
      throw new Error(`Unknown Intent Program specification pointer: ${pointer}`);
    }
    value = value[segment];
  }
  return value;
};

export function resolveIntentProgramVocabulary<
  TPointer extends IntentProgramVocabularyPointer
>(pointer: TPointer): IntentProgramVocabularyAt<TPointer>;
export function resolveIntentProgramVocabulary(
  pointer: string
): readonly string[];
export function resolveIntentProgramVocabulary(
  pointer: string
): readonly string[] {
  const value = resolveIntentProgramSpecificationPointer(pointer);
  if (!isStringArray(value)) {
    throw new Error(`Intent Program pointer is not a vocabulary: ${pointer}`);
  }
  return value;
}

export const intentProgramCardinalityBounds = (
  cardinality: IntentProgramSourceCardinality
): Readonly<{ min: number; max: number | null }> => {
  if (cardinality === 'exactly-one') return { min: 1, max: 1 };
  if (typeof cardinality === 'number') {
    return { min: cardinality, max: cardinality };
  }
  return cardinality;
};

export const intentProgramCountSatisfiesCardinality = (
  count: number,
  cardinality: IntentProgramSourceCardinality
): boolean => {
  const bounds = intentProgramCardinalityBounds(cardinality);
  return count >= bounds.min && (bounds.max === null || count <= bounds.max);
};

export const intentProgramAllowsOccurrence = (
  existingCount: number,
  cardinality: IntentProgramSourceCardinality
): boolean => {
  const { max } = intentProgramCardinalityBounds(cardinality);
  return max === null || existingCount < max;
};

/** Applies the exact whole-asset name policy published by the language. */
export const normalizeIntentProgramName = (value: string): string => {
  const policy = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.invariants.name;
  if (policy.normalization === 'trim-collapse-whitespace') {
    return value.trim().replace(/\s+/g, ' ');
  }
  return value;
};
