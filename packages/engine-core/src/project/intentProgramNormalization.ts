import type {
  ProjectSemanticContract,
  ProjectSupportedSurfaceObligation
} from '../model';
import type {
  IntentProgramDiagnostic,
  IntentProgramFace,
  IntentProgramIr
} from './intentProgramTypes';
import type { RawIntentProgram } from './intentProgramSyntax';

/** The parser surface required by semantic normalization. */
export interface IntentProgramNormalizationReporter {
  readonly diagnostics: readonly IntentProgramDiagnostic[];
  reportPath(code: string, message: string, path: string): void;
}

/**
 * Validates cross-declaration relationships, then produces the sole canonical
 * compiler input. Syntax and token ownership stay in the reader; no lowering
 * concerns are allowed here.
 */
export const normalizeIntentProgram = (
  raw: RawIntentProgram,
  reader: IntentProgramNormalizationReporter
): IntentProgramIr | null => {
  const required: readonly [boolean, string, string][] = [
    [Boolean(raw.asset), 'asset', 'asset'],
    [Boolean(raw.track), 'track', 'track'],
    [Boolean(raw.domain), 'domain', 'domain'],
    [Boolean(raw.frame), 'frame', 'frame'],
    [Boolean(raw.symmetry), 'symmetry', 'symmetry'],
    [Boolean(raw.rest), 'rest', 'rest'],
    [Boolean(raw.face), 'face', 'face'],
    [Boolean(raw.motion), 'motion', 'motion'],
    [Boolean(raw.style.palette), 'style palette', 'style.palette']
  ];
  for (const [present, name, path] of required) {
    if (!present) {
      reader.reportPath(
        'intent.missing_required',
        `Missing required ${name} declaration.`,
        path
      );
    }
  }

  const face = raw.face;
  if (face?.kind === 'full' && (!face.eyes || !face.gaze || !face.nose || !face.mouth)) {
    reader.reportPath(
      'intent.incomplete_face',
      'A full face requires eyes, gaze center, nose, and mouth.',
      'face'
    );
  }

  const bodyIds = new Set(raw.body.map((module) => module.id));
  const rest = raw.rest;
  if (rest && rest.kind !== 'airborne' && !bodyIds.has(rest.on)) {
    reader.reportPath(
      'intent.unknown_rest_host',
      `Rest support names unknown body host "${rest.on}".`,
      'rest.on'
    );
  }
  const faceHost = face?.kind === 'full' ? face.on : undefined;
  if (faceHost && !bodyIds.has(faceHost)) {
    reader.reportPath(
      'intent.unknown_face_host',
      `Face names unknown body host "${faceHost}".`,
      'face.on'
    );
  }
  if (raw.focal && !bodyIds.has(raw.focal.on)) {
    reader.reportPath(
      'intent.unknown_focal_host',
      `Focal stage names unknown body host "${raw.focal.on}".`,
      'focal.on'
    );
  }

  if (raw.track === 'hero' && (face?.kind === 'full') === Boolean(raw.focal)) {
    reader.reportPath(
      'intent.hero_requires_one_focal_stage',
      'Hero track requires exactly one focal stage: face full on <body-id>, or focal <id> on <body-id>.',
      raw.focal ? 'focal' : 'face'
    );
  }
  if (raw.track === 'essential' && raw.focal) {
    reader.reportPath(
      'intent.focal_requires_hero_track',
      'focal is the hero-only alternative to a full face.',
      'focal'
    );
  }
  if (raw.symmetry === 'asymmetric') {
    for (const module of raw.body) {
      if (module.configuration === 'paired') {
        reader.reportPath(
          'intent.paired_module_requires_bilateral',
          `Paired module "${module.id}" requires bilateral symmetry.`,
          `body.${module.id}.configuration`
        );
      }
    }
    for (const surface of raw.surfaces) {
      if (surface.configuration === 'paired') {
        reader.reportPath(
          'intent.paired_surface_requires_bilateral',
          `Paired surface "${surface.id}" requires bilateral symmetry.`,
          `surfaces.${surface.id}.configuration`
        );
      }
    }
    if (face?.kind === 'full' && face.eyes === 'paired') {
      reader.reportPath(
        'intent.paired_eyes_require_bilateral',
        'Paired eyes require bilateral symmetry.',
        'face.eyes'
      );
    }
  }
  if (raw.symmetry === 'bilateral') {
    for (const surface of raw.surfaces) {
      if (
        surface.configuration === 'single' &&
        (surface.extension === 'left' || surface.extension === 'right')
      ) {
        reader.reportPath(
          'intent.single_sided_surface_requires_asymmetric',
          `Single ${surface.extension} surface "${surface.id}" requires asymmetric symmetry.`,
          `surfaces.${surface.id}.extension`
        );
      }
    }
  }

  if (
    reader.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
    !raw.asset ||
    !raw.track ||
    !raw.domain ||
    !raw.frame ||
    !raw.symmetry ||
    !raw.rest ||
    !raw.face ||
    !raw.motion ||
    !raw.style.palette
  ) return null;

  const surfaces = [...raw.surfaces].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const obligations: ProjectSupportedSurfaceObligation[] = surfaces.map(
    (surface) => ({
      id: surface.id,
      role: surface.role,
      configuration: surface.configuration,
      extension: surface.extension
    })
  );
  const normalizedFace: IntentProgramFace = raw.face.kind === 'none'
    ? { kind: 'none' }
    : {
        kind: 'full',
        on: raw.face.on,
        eyes: raw.face.eyes!,
        gaze: raw.face.gaze!,
        nose: raw.face.nose!,
        mouth: raw.face.mouth!
      };
  const palette = raw.style.palette;
  if (!palette) return null;
  const semanticContract: ProjectSemanticContract = {
    subjectDomain: raw.domain,
    canonicalSupport: raw.rest.kind === 'feet'
      ? { kind: 'standing-feet' }
      : raw.rest.kind === 'base'
        ? { kind: 'supported-base' }
        : raw.rest.kind === 'wheels'
          ? { kind: 'rolling-wheels' }
          : { kind: 'airborne' },
    face: normalizedFace.kind === 'none'
      ? { kind: 'none' }
      : {
          kind: 'full',
          eyeConfiguration: normalizedFace.eyes,
          nasal: normalizedFace.nose,
          oral: normalizedFace.mouth === 'absent' ? 'absent' : 'present'
        },
    supportedSurfaces: obligations
  };
  return {
    asset: raw.asset,
    track: raw.track,
    domain: raw.domain,
    frame: { facing: raw.frame },
    symmetry: raw.symmetry,
    rest: raw.rest,
    body: [...raw.body].sort((left, right) => left.id.localeCompare(right.id)),
    surfaces,
    face: normalizedFace,
    ...(raw.focal ? { focal: raw.focal } : {}),
    motion: raw.motion,
    style: { palette },
    semanticContract
  };
};
