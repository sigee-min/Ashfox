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
const faceSchema = specification.statements.model.face;
const absentFaceKind = faceSchema.sourceTokensByProperty.none[0];
const completeFaceKind = faceSchema.fields.parent.required;
const faceKeys = new Set([
  'kind', 'parent', 'eyes', 'gaze', 'nose', 'mouth'
]);

const validateFace = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  const face = isInputRecord(candidate.face) ? candidate.face : undefined;
  if (!face || !isVocabularyWord(face.kind, specification.model.faceKinds)) {
    report(
      'face',
      'intent-program.invalid-normalized-face',
      'A compiler input requires face none or a complete face declaration.'
    );
    return;
  }
  if (face.kind === absentFaceKind) {
    reportUnknownInputKeys(
      face, new Set(['kind']), 'face',
      'intent-program.unknown-normalized-property', 'Face', report
    );
    return;
  }
  reportUnknownInputKeys(
    face, faceKeys, 'face',
    'intent-program.unknown-normalized-property', 'Face', report
  );
  const fields: readonly [boolean, string][] = [
    [isInputIdentifier(face.parent), 'parent'],
    [isVocabularyWord(
      face.eyes, specification.model.eyeConfigurations
    ), 'eyes'],
    [isVocabularyWord(face.gaze, specification.model.gazeModes), 'gaze'],
    [isVocabularyWord(face.nose, specification.model.noseModes), 'nose'],
    [isVocabularyWord(face.mouth, specification.model.mouthModes), 'mouth']
  ];
  for (const [valid, field] of fields) {
    if (!valid) report(
      `face.${field}`,
      'intent-program.incomplete-normalized-face',
      `A ${completeFaceKind} face requires canonical ${field}.`
    );
  }
};

const validateFocal = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  const focal = candidate.focal;
  if (focal !== undefined && !isInputRecord(focal)) report(
    'focal', 'intent-program.invalid-normalized-focal',
    'A focal stage must be one closed object.'
  );
  else if (isInputRecord(focal)) {
    reportUnknownInputKeys(
      focal, new Set(['id', 'parent']), 'focal',
      'intent-program.unknown-normalized-property', 'Focal stage', report
    );
    if (!isInputIdentifier(focal.id)) report(
      'focal.id', 'intent-program.invalid-normalized-focal-id',
      'A focal stage ID must be lower-kebab-case.'
    );
    if (!isInputIdentifier(focal.parent)) report(
      'focal.parent', 'intent-program.invalid-normalized-focal-parent',
      'A focal parent ID must be lower-kebab-case.'
    );
  }
};

const validateAnimation = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  const animation = isInputRecord(candidate.animation)
    ? candidate.animation
    : undefined;
  const idle = animation && isInputRecord(animation.idle)
    ? animation.idle
    : undefined;
  if (!animation || !idle) {
    report(
      'animation.idle',
      'intent-program.invalid-normalized-animation',
      'A compiler input requires idle still, breathe, or scan with an optional target.'
    );
    return;
  }
  reportUnknownInputKeys(
    animation, new Set(['idle']), 'animation',
    'intent-program.unknown-normalized-property', 'Animation', report
  );
  if (!isVocabularyWord(
    idle.mode, specification.animation.idleModes
  )) report(
    'animation.idle.mode',
    'intent-program.invalid-normalized-animation-mode',
    'Idle mode must be still, breathe, or scan.'
  );
  if (idle.target !== undefined && !isInputIdentifier(idle.target)) report(
    'animation.idle.target',
    'intent-program.invalid-normalized-animation-target',
    'Idle target ID must be lower-kebab-case.'
  );
  reportUnknownInputKeys(
    idle, new Set(['mode', 'target']), 'animation.idle',
    'intent-program.unknown-normalized-property', 'Idle animation', report
  );
};

export const validateIntentProgramPresentation = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  validateFace(candidate, report);
  validateFocal(candidate, report);
  validateAnimation(candidate, report);
};
