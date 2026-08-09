export type IntentProgramInputRecord = Readonly<Record<string, unknown>>;

export type IntentProgramInputReporter = (
  path: string,
  code: string,
  message: string
) => void;

export const reportUnknownInputKeys = (
  value: IntentProgramInputRecord,
  allowed: ReadonlySet<string>,
  path: string,
  code: string,
  owner: string,
  report: IntentProgramInputReporter
): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) report(
      path ? `${path}.${key}` : key,
      code,
      `${owner} contains unknown property "${key}".`
    );
  }
};

export const isInputRecord = (
  value: unknown
): value is IntentProgramInputRecord =>
  typeof value === 'object' && value !== null;

export const hasInputString = (
  value: IntentProgramInputRecord,
  key: string
): boolean => typeof value[key] === 'string' && value[key].length > 0;

export const isInputIdentifier = (
  value: unknown
): value is string => isProjectSemanticIdentifier(value);

export const isVocabularyWord = <Values extends readonly string[]>(
  value: unknown,
  values: Values
): value is Values[number] =>
  typeof value === 'string' && values.some((entry) => entry === value);
import { isProjectSemanticIdentifier } from '../../../project/identifier';
