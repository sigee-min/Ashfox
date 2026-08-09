import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../../project/program/language';
import {
  isInputIdentifier,
  isInputRecord,
  reportUnknownInputKeys,
  type IntentProgramInputRecord,
  type IntentProgramInputReporter
} from './contract';

const specification = INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
const roles = new Set<string>(specification.model.surfaceRoles);
const cardinalities = new Set<string>(specification.model.cardinalities);
const anchors = new Set<string>(specification.anchors);
const growth = new Set<string>(specification.growth);
const lanes = new Set<string>(specification.lanes);
const surfaceKeys = new Set([
  'id', 'role', 'cardinality', 'parent', 'anchor', 'growth', 'lane', 'shape'
]);
const shapeKeys = new Set([
  'axis', 'span', 'chord', 'tip', 'offset', 'edge'
]);

const shapeFields = [
  ['axis', new Set<string>(specification.surfaceShapes.axis)],
  ['span', new Set<string>(specification.surfaceShapes.span)],
  ['chord', new Set<string>(specification.surfaceShapes.chord)],
  ['tip', new Set<string>(specification.surfaceShapes.tip)],
  ['offset', new Set<string>(specification.surfaceShapes.offset)],
  ['edge', new Set<string>(specification.surfaceShapes.edge)]
] as const;

const validateShape = (
  entry: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  if (entry.shape === undefined) return;
  const id = String(entry.id);
  const path = `surfaces.${id}`;
  if (!isInputRecord(entry.shape)) {
    report(
      `${path}.shape`,
      'intent-program.invalid-normalized-surface-shape',
      `Surface "${id}" shape must be one closed semantic object.`
    );
    return;
  }
  const shape = entry.shape;
  reportUnknownInputKeys(
    shape,
    shapeKeys,
    `${path}.shape`,
    'intent-program.unknown-normalized-surface-shape-property',
    `Surface "${id}" shape`,
    report
  );
  for (const [field, vocabulary] of shapeFields) {
    if (vocabulary.has(String(shape[field]))) continue;
    report(
      `${path}.shape.${field}`,
      'intent-program.invalid-normalized-surface-shape',
      `Surface "${id}" shape ${field} uses unsupported vocabulary.`
    );
  }
};

export const validateIntentProgramSurfaces = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  if (
    !Array.isArray(candidate.surfaces) ||
    !candidate.surfaces.every((entry: unknown) => isInputRecord(entry))
  ) {
    report(
      'surfaces',
      'intent-program.invalid-normalized-surfaces',
      'A compiler input requires a normalized supported-surface list.'
    );
    return;
  }
  for (const [index, entry] of candidate.surfaces.entries()) {
    const idValid = isInputIdentifier(entry.id);
    const id = idValid ? entry.id : String(index);
    const path = `surfaces.${id}`;
    reportUnknownInputKeys(
      entry,
      surfaceKeys,
      path,
      'intent-program.unknown-normalized-surface-property',
      `Surface "${id}"`,
      report
    );
    const fields: readonly [boolean, string][] = [
      [idValid, 'id'],
      [roles.has(String(entry.role)), 'role'],
      [cardinalities.has(String(entry.cardinality)), 'cardinality'],
      [isInputIdentifier(entry.parent), 'parent'],
      [anchors.has(String(entry.anchor)), 'anchor'],
      [growth.has(String(entry.growth)), 'growth'],
      [lanes.has(String(entry.lane)), 'lane']
    ];
    for (const [valid, field] of fields) {
      if (!valid) report(
        `${path}.${field}`,
        'intent-program.invalid-normalized-surface',
        `Surface requires canonical ${field}.`
      );
    }
    validateShape(entry, report);
  }
};
