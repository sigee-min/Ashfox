import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../../project/program/language';
import { normalizeIntentProgramName } from '../../../project/program/schema';
import {
  isInputIdentifier,
  isInputRecord,
  reportUnknownInputKeys,
  type IntentProgramInputRecord,
  type IntentProgramInputReporter
} from './contract';

const specification = INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
const orientationKeys = new Set(['forward']);
const supportKeys = new Set(['kind', 'contacts']);

const hasVocabulary = (
  value: unknown,
  values: readonly string[]
): boolean => typeof value === 'string' && values.includes(value);

const validateSupport = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  const support = isInputRecord(candidate.support) ? candidate.support : undefined;
  if (!support ||
    !hasVocabulary(support.kind, specification.supportKinds) ||
    !Array.isArray(support.contacts)) {
    report(
      'support',
      'intent-program.invalid-normalized-support',
      'A compiler input requires one canonical support declaration.'
    );
    return;
  }
  reportUnknownInputKeys(
    support, supportKeys, 'support',
    'intent-program.unknown-normalized-property', 'Support', report
  );
  support.contacts.forEach((contact, index) => {
    if (!isInputIdentifier(contact)) report(
      `support.contacts.${index}`,
      'intent-program.invalid-normalized-support-contact',
      'Every support contact ID must be lower-kebab-case.'
    );
  });
};

export const validateIntentProgramRoot = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  const namePolicy = specification.invariants.name;
  if (typeof candidate.name !== 'string' ||
    (namePolicy.nonEmpty && candidate.name.length === 0) ||
    candidate.name !== normalizeIntentProgramName(candidate.name)) report(
    'name',
    'intent-program.invalid-normalized-name',
    'A compiler input requires a non-empty asset name.'
  );
  if (!hasVocabulary(candidate.track, specification.metadata.tracks)) report(
    'track',
    'intent-program.invalid-normalized-track',
    'A compiler input requires track essential or hero.'
  );
  if (!hasVocabulary(candidate.domain, specification.metadata.domains)) report(
    'domain',
    'intent-program.invalid-normalized-domain',
    'A compiler input requires domain organism or constructed.'
  );
  const orientation = isInputRecord(candidate.orientation)
    ? candidate.orientation
    : undefined;
  if (!orientation || !hasVocabulary(
    orientation.forward,
    specification.model.forwardDirections
  )) report(
    'orientation.forward',
    'intent-program.invalid-normalized-orientation',
    'A compiler input requires one canonical forward direction.'
  );
  else reportUnknownInputKeys(
    orientation, orientationKeys, 'orientation',
    'intent-program.unknown-normalized-property', 'Orientation', report
  );
  if (!hasVocabulary(candidate.symmetry, specification.model.symmetries)) report(
    'symmetry',
    'intent-program.invalid-normalized-symmetry',
    'A compiler input requires bilateral or asymmetric symmetry.'
  );
  validateSupport(candidate, report);
};
