import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../../project/program/language';
import {
  isInputIdentifier,
  isInputRecord,
  isVocabularyWord,
  reportUnknownInputKeys,
  type IntentProgramInputRecord,
  type IntentProgramInputReporter
} from './contract';

const specification = INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
export const INTENT_PROGRAM_INPUT_CORE_POLICY =
  specification.invariants.body.core;
const coreKeys = new Set(['id', 'kind', 'cardinality']);
const attachedKeys = new Set([
  'id', 'kind', 'cardinality', 'parent', 'anchor', 'growth', 'lane'
]);

const reportField = (
  valid: boolean,
  path: string,
  field: string,
  report: IntentProgramInputReporter
): void => {
  if (!valid) report(
    `${path}.${field}`,
    'intent-program.incomplete-normalized-module',
    `Body module requires canonical ${field}.`
  );
};

const validateBodyEntry = (
  entry: IntentProgramInputRecord,
  index: number,
  report: IntentProgramInputReporter
): void => {
  const idValid = isInputIdentifier(entry.id);
  const id = idValid ? entry.id : String(index);
  const path = `body.${id}`;
  if (!idValid) report(
    `${path}.id`,
    'intent-program.invalid-normalized-module-id',
    'Every body module ID must be lower-kebab-case.'
  );
  const kindValid = isVocabularyWord(
    entry.kind, specification.model.moduleKinds
  );
  if (!kindValid) report(
    `${path}.kind`,
    'intent-program.invalid-normalized-module-kind',
    'Every body module requires one canonical kind.'
  );
  if (!kindValid) return;
  const kind = entry.kind;
  if (kind === INTENT_PROGRAM_INPUT_CORE_POLICY.kind) {
    reportUnknownInputKeys(
      entry, coreKeys, path, 'intent-program.unknown-normalized-property',
      `Body module "${id}"`, report
    );
    if (entry.cardinality !== INTENT_PROGRAM_INPUT_CORE_POLICY.cardinality) report(
      `${path}.cardinality`,
      'intent-program.invalid-normalized-module-cardinality',
      `Core body module "${id}" is always ${
        INTENT_PROGRAM_INPUT_CORE_POLICY.cardinality
      }.`
    );
    return;
  }
  reportUnknownInputKeys(
    entry, attachedKeys, path, 'intent-program.unknown-normalized-property',
    `Body module "${id}"`, report
  );
  reportField(isInputIdentifier(entry.parent), path, 'parent', report);
  reportField(
    isVocabularyWord(entry.anchor, specification.anchors), path, 'anchor', report
  );
  reportField(
    isVocabularyWord(entry.growth, specification.growth), path, 'growth', report
  );
  reportField(
    isVocabularyWord(entry.lane, specification.lanes), path, 'lane', report
  );
  const cardinalityValid = isVocabularyWord(
    entry.cardinality,
    specification.model.cardinalities
  );
  reportField(cardinalityValid, path, 'cardinality', report);
};

export const validateIntentProgramBody = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  if (!Array.isArray(candidate.body) ||
    !candidate.body.every((entry: unknown) => isInputRecord(entry))) {
    report(
      'body',
      'intent-program.invalid-normalized-body',
      'A compiler input requires a normalized body-module list.'
    );
    return;
  }
  candidate.body.forEach((entry, index) =>
    validateBodyEntry(entry, index, report));
};
