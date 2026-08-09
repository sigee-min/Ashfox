import { resolveIntentProgramBodyGraph } from '../../../project/program/constraints/graph';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../../project/program/language';
import type { IntentProgramModule } from '../../../project/program/types';
import { compareStableText } from '../../../stableOrder';
import {
  hasInputString,
  isInputRecord,
  isVocabularyWord,
  type IntentProgramInputRecord,
  type IntentProgramInputReporter
} from './contract';
import { INTENT_PROGRAM_INPUT_CORE_POLICY } from './body';

const isModule = (value: unknown): value is IntentProgramModule => {
  if (!isInputRecord(value) || !hasInputString(value, 'id') ||
    !isVocabularyWord(
      value.kind,
      INTENT_PROGRAM_LANGUAGE_SPECIFICATION.model.moduleKinds
    )) return false;
  if (value.kind === INTENT_PROGRAM_INPUT_CORE_POLICY.kind) {
    return value.cardinality === INTENT_PROGRAM_INPUT_CORE_POLICY.cardinality;
  }
  return hasInputString(value, 'parent') &&
    isVocabularyWord(
      value.cardinality,
      INTENT_PROGRAM_LANGUAGE_SPECIFICATION.model.cardinalities
    ) &&
    isVocabularyWord(value.anchor, INTENT_PROGRAM_LANGUAGE_SPECIFICATION.anchors) &&
    isVocabularyWord(value.growth, INTENT_PROGRAM_LANGUAGE_SPECIFICATION.growth) &&
    isVocabularyWord(value.lane, INTENT_PROGRAM_LANGUAGE_SPECIFICATION.lanes);
};

const sameOrder = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/** Rejects hand-built IR that bypasses the canonical constraint ordering. */
export const validateIntentProgramCanonicalOrder = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  if (Array.isArray(candidate.body) && candidate.body.every(isModule)) {
    const modules = candidate.body;
    const index = new Map<string, number>();
    modules.forEach((module, position) => {
      if (!index.has(module.id)) index.set(module.id, position);
    });
    if (index.size === modules.length) {
      const resolved = resolveIntentProgramBodyGraph(modules, index);
      if (resolved.order.length === modules.length && !sameOrder(
        modules.map((module) => module.id),
        resolved.order.map((module) => module.id)
      )) report(
        'body',
        'intent-program.noncanonical-body-order',
        'Compiler body modules must use parent-before-child lexical-ready order.'
      );
    }
  }

  if (Array.isArray(candidate.surfaces) && candidate.surfaces.every(
    (surface: unknown) => isInputRecord(surface) && hasInputString(surface, 'id')
  )) {
    const ids = candidate.surfaces.map((surface) => String(surface.id));
    if (new Set(ids).size === ids.length &&
      !sameOrder(ids, [...ids].sort(compareStableText))) report(
      'surfaces',
      'intent-program.noncanonical-surface-order',
      'Compiler surfaces must use lexical stable-ID order.'
    );
  }

  const support = isInputRecord(candidate.support) ? candidate.support : undefined;
  if (support && Array.isArray(support.contacts) && support.contacts.every(
    (contact: unknown): contact is string => typeof contact === 'string'
  ) && !sameOrder(
    support.contacts,
    [...support.contacts].sort(compareStableText)
  )) report(
    'support.contacts',
    'intent-program.noncanonical-support-order',
    'Compiler support contacts must use lexical stable-ID order.'
  );
};
