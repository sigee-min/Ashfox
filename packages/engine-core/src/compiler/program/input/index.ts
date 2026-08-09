import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramSpan
} from '../../../project/program/types';
import { intentProgramDiagnostic } from '../diagnostic';
import { validateIntentProgramAppearanceInput } from './appearance';
import { validateIntentProgramBody } from './body';
import {
  reportUnknownInputKeys,
  type IntentProgramInputRecord,
  type IntentProgramInputReporter
} from './contract';
import { validateIntentProgramCanonicalOrder } from './order';
import { validateIntentProgramPresentation } from './presentation';
import { validateIntentProgramRoot } from './root';
import { validateIntentProgramSemantics } from './semantic';
import { validateIntentProgramSurfaces } from './surface';

const rootKeys = new Set([
  'name', 'track', 'domain', 'orientation', 'symmetry', 'support', 'body',
  'surfaces', 'face', 'focal', 'animation', 'appearance'
]);

const semanticSafeStructuralCodes = new Set([
  'intent-program.unknown-normalized-property',
  'intent-program.unknown-normalized-surface-property',
  'intent-program.unknown-normalized-surface-shape-property',
  'intent-program.noncanonical-body-order',
  'intent-program.noncanonical-surface-order',
  'intent-program.noncanonical-support-order',
  'intent-program.noncanonical-normalized-appearance'
]);

/** Closes the public JavaScript/import boundary before compiler planning. */
export const validateIntentProgramInput = (
  program: IntentProgramIr,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): readonly IntentProgramDiagnostic[] => {
  const diagnostics: IntentProgramDiagnostic[] = [];
  const report: IntentProgramInputReporter = (path, code, message): void => {
    diagnostics.push(intentProgramDiagnostic(sourceMap, path, code, message));
  };
  const candidate: IntentProgramInputRecord = Object(program);
  reportUnknownInputKeys(
    candidate,
    rootKeys,
    '',
    'intent-program.unknown-normalized-property',
    'Compiler input',
    report
  );
  validateIntentProgramRoot(candidate, report);
  validateIntentProgramBody(candidate, report);
  validateIntentProgramSurfaces(candidate, report);
  validateIntentProgramPresentation(candidate, report);
  validateIntentProgramAppearanceInput(candidate, report);
  validateIntentProgramCanonicalOrder(candidate, report);
  if (diagnostics.every((entry) =>
    semanticSafeStructuralCodes.has(entry.code)
  )) {
    validateIntentProgramSemantics(program, report);
  }
  return Object.freeze([...diagnostics]);
};
