import {
  INTENT_PROGRAM_PALETTES,
  type IntentProgramDiagnostic,
  type IntentProgramIr,
  type IntentProgramSpan
} from '../../project/intentProgramTypes';
import { intentProgramDiagnostic } from './diagnostics';

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const stringField = (value: UnknownRecord, key: string): boolean =>
  typeof value[key] === 'string' && value[key].length > 0;

const supportedPalettes = new Set<string>(INTENT_PROGRAM_PALETTES);
const moduleKinds = new Set([
  'core', 'mass', 'chain', 'limb', 'wheel', 'radial'
]);
const moduleExtensions = new Set([
  'forward', 'rearward', 'up', 'down', 'left', 'right'
]);
const surfaceRoles = new Set(['wing', 'fin', 'sail', 'panel']);
const surfaceConfigurations = new Set(['single', 'paired']);
const surfaceExtensions = new Set([
  'lateral', 'left', 'right', 'up', 'forward', 'rearward'
]);

/**
 * `IntentProgramIr` is public compiler input. Runtime validation therefore
 * closes the JavaScript/import boundary before graph validation or semantic
 * projection can observe an omitted declaration as a hidden default.
 */
export const validateIntentProgramInput = (
  program: IntentProgramIr,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): readonly IntentProgramDiagnostic[] => {
  const diagnostics: IntentProgramDiagnostic[] = [];
  const report = (path: string, code: string, message: string): void => {
    diagnostics.push(intentProgramDiagnostic(sourceMap, path, code, message));
  };
  // `Object` also turns a malformed JavaScript null/primitive input into a
  // harmless empty record without bypassing the type system with a cast.
  const candidate = Object(program);
  if (!stringField(candidate, 'asset')) {
    report('asset', 'intent-program.invalid-normalized-asset', 'A compiler input requires a non-empty asset name.');
  }
  if (candidate.track !== 'essential' && candidate.track !== 'hero') {
    report('track', 'intent-program.invalid-normalized-track', 'A compiler input requires track essential or hero.');
  }
  if (candidate.domain !== 'organism' && candidate.domain !== 'constructed') {
    report('domain', 'intent-program.invalid-normalized-domain', 'A compiler input requires domain organism or constructed.');
  }
  const frame = isRecord(candidate.frame) ? candidate.frame : undefined;
  if (!frame || !['north', 'south', 'east', 'west'].includes(String(frame.facing))) {
    report('frame.facing', 'intent-program.invalid-normalized-frame', 'A compiler input requires one canonical front direction.');
  }
  if (candidate.symmetry !== 'bilateral' && candidate.symmetry !== 'asymmetric') {
    report('symmetry', 'intent-program.invalid-normalized-symmetry', 'A compiler input requires bilateral or asymmetric symmetry.');
  }
  const rest = isRecord(candidate.rest) ? candidate.rest : undefined;
  const restKind = rest?.kind;
  if (!rest || !['feet', 'base', 'wheels', 'airborne'].includes(String(restKind))) {
    report('rest', 'intent-program.invalid-normalized-rest', 'A compiler input requires one canonical rest declaration.');
  } else if (restKind !== 'airborne' && !stringField(rest, 'on')) {
    report('rest.on', 'intent-program.invalid-normalized-rest-host', 'Grounded rest must name its structural support module.');
  }
  if (!Array.isArray(candidate.body) || !candidate.body.every((entry: unknown) =>
    isRecord(entry) && stringField(entry, 'id') && moduleKinds.has(String(entry.kind))
  )) {
    report('body', 'intent-program.invalid-normalized-body', 'A compiler input requires a normalized body-module list.');
  } else {
    for (const entry of candidate.body as readonly UnknownRecord[]) {
      if (entry.kind === 'core') continue;
      if (!stringField(entry, 'from') || !moduleExtensions.has(String(entry.extension))) {
        report(`body.${String(entry.id)}`, 'intent-program.incomplete-normalized-module', `Body module "${String(entry.id)}" requires a structural host and named extension.`);
      }
      if ((entry.kind === 'limb' || entry.kind === 'wheel') && entry.configuration !== 'paired') {
        report(`body.${String(entry.id)}.configuration`, 'intent-program.invalid-normalized-module-pair', `Body ${String(entry.kind)} module "${String(entry.id)}" requires pair configuration.`);
      }
    }
  }
  if (!Array.isArray(candidate.surfaces) || !candidate.surfaces.every((entry: unknown) =>
    isRecord(entry) && stringField(entry, 'id') && stringField(entry, 'from') &&
      surfaceRoles.has(String(entry.role)) &&
      surfaceConfigurations.has(String(entry.configuration)) &&
      surfaceExtensions.has(String(entry.extension))
  )) {
    report('surfaces', 'intent-program.invalid-normalized-surfaces', 'A compiler input requires a normalized supported-surface list.');
  }
  const face = isRecord(candidate.face) ? candidate.face : undefined;
  if (!face || (face.kind !== 'none' && face.kind !== 'full')) {
    report('face', 'intent-program.invalid-normalized-face', 'A compiler input requires face none or a complete face declaration.');
  } else if (face.kind === 'full' && (
    !stringField(face, 'on') ||
    !['single', 'paired'].includes(String(face.eyes)) ||
    face.gaze !== 'center' ||
    !['present', 'absent'].includes(String(face.nose)) ||
    !['absent', 'neutral', 'beak', 'fang'].includes(String(face.mouth))
  )) {
    report('face', 'intent-program.incomplete-normalized-face', 'A full compiler face requires host, eyes, centered gaze, nose, and mouth.');
  }
  const focal = candidate.focal;
  if (focal !== undefined && (!isRecord(focal) || !stringField(focal, 'id') || !stringField(focal, 'on'))) {
    report('focal', 'intent-program.invalid-normalized-focal', 'A focal stage requires its ID and structural host.');
  }
  if (candidate.track === 'hero' && (face?.kind === 'full') === (focal !== undefined)) {
    report('focal', 'intent-program.hero-requires-one-focal-stage', 'Hero track requires exactly one focal stage: a full face or focal declaration.');
  }
  if (candidate.track === 'essential' && focal !== undefined) {
    report('focal', 'intent-program.focal-requires-hero-track', 'focal is the hero-only alternative to a full face.');
  }
  const motion = isRecord(candidate.motion) ? candidate.motion : undefined;
  if (!motion || motion.kind !== 'idle' || !['still', 'breathe', 'scan'].includes(String(motion.mode))) {
    report('motion', 'intent-program.invalid-normalized-motion', 'A compiler input requires motion idle still, breathe, or scan.');
  }
  const style = isRecord(candidate.style) ? candidate.style : undefined;
  if (!style || !supportedPalettes.has(String(style.palette))) {
    report('style.palette', 'intent-program.invalid-normalized-palette', 'A compiler input requires one declared canonical palette.');
  }
  return diagnostics;
};
