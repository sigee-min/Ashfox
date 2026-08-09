import type {
  ProjectCanonicalSupport,
  ProjectIntent,
  ProjectSemanticContract,
  ProjectSemanticFace
} from '../../model';
import { canonicalJsonString } from '../../canonicalJson';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramSpan
} from '../../project/intentProgramTypes';

const fallbackSpan: IntentProgramSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 }
};

const spanAt = (
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  path: string
): IntentProgramSpan => sourceMap[path] ?? fallbackSpan;

const error = (
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  path: string,
  code: string,
  message: string
): IntentProgramDiagnostic => ({
  severity: 'error',
  code,
  message,
  span: spanAt(sourceMap, path)
});

const supportFor = (program: IntentProgramIr): ProjectCanonicalSupport => {
  switch (program.rest.kind) {
    case 'feet': return { kind: 'standing-feet' };
    case 'base': return { kind: 'supported-base' };
    case 'airborne': return { kind: 'airborne' };
  }
};

const faceFor = (program: IntentProgramIr): ProjectSemanticFace => {
  if (program.face.kind === 'none') return { kind: 'none' };
  return {
    kind: 'full',
    eyeConfiguration: program.face.eyes ?? 'paired',
    nasal: program.face.nose === 'absent' ? 'absent' : 'present',
    oral: program.face.mouth === 'absent' ? 'absent' : 'present'
  };
};

export const projectIntentProgramSemantics = (
  program: IntentProgramIr,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
):
  | { ok: true; intent: ProjectIntent }
  | { ok: false; diagnostics: readonly IntentProgramDiagnostic[] } => {
  const diagnostics: IntentProgramDiagnostic[] = [];
  if (program.symmetry === 'asymmetric' &&
    program.surfaces.some((surface) => surface.configuration === 'paired')) {
    diagnostics.push(error(
      sourceMap,
      'symmetry',
      'intent-program.symmetric-surface-requires-bilateral',
      'Paired supported surfaces require bilateral symmetry.'
    ));
  }
  if (program.symmetry === 'asymmetric' && program.face.eyes === 'paired') {
    diagnostics.push(error(
      sourceMap,
      'face.eyes',
      'intent-program.paired-eyes-require-bilateral',
      'Paired eyes require bilateral symmetry.'
    ));
  }
  if (program.domain === 'organism' && program.rest.kind === 'base') {
    diagnostics.push(error(
      sourceMap,
      'rest',
      'intent-program.organism-base-support',
      'Organisms cannot declare a base as their canonical neutral support.'
    ));
  }
  const seenSurfaces = new Set<string>();
  for (const surface of program.surfaces) {
    if (seenSurfaces.has(surface.id)) {
      diagnostics.push(error(
        sourceMap,
        `surfaces.${surface.id}`,
        'intent-program.duplicate-surface',
        `Supported surface "${surface.id}" is declared more than once.`
      ));
    }
    seenSurfaces.add(surface.id);
    if (!program.body.some((module) => module.id === surface.from)) {
      diagnostics.push(error(
        sourceMap,
        `surfaces.${surface.id}.from`,
        'intent-program.unknown-surface-host',
        `Supported surface "${surface.id}" names unknown host "${surface.from}".`
      ));
    }
    if (surface.configuration === 'single' && surface.extension === 'lateral') {
      diagnostics.push(error(
        sourceMap,
        `surfaces.${surface.id}.extension`,
        'intent-program.single-lateral-surface',
        'A single supported surface cannot extend laterally; use paired, up, forward, or rearward.'
      ));
    }
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  const semanticContract: ProjectSemanticContract = {
    subjectDomain: program.domain,
    canonicalSupport: supportFor(program),
    face: faceFor(program),
    supportedSurfaces: program.surfaces
      .map((surface) => ({
        id: surface.id,
        role: surface.role,
        configuration: surface.configuration,
        extension: surface.extension
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  };
  if (canonicalJsonString(semanticContract) !==
    canonicalJsonString(program.semanticContract)) {
    return {
      ok: false,
      diagnostics: [error(
        sourceMap,
        'semanticContract',
        'intent-program.semantic-projection-mismatch',
        'Normalized semantic authority does not match the program-derived semantic projection.'
      )]
    };
  }
  return {
    ok: true,
    intent: {
      subject: program.asset,
      forward: program.frame.facing,
      grounding: program.rest.kind === 'feet' || program.rest.kind === 'base'
        ? 'grounded'
        : 'airborne',
      symmetry: program.symmetry === 'bilateral'
        ? { kind: 'bilateral', planeTwice: 0 }
        : { kind: 'asymmetric' },
      semanticContract,
      features: [
        ...program.body.map((module) => `${module.kind}:${module.id}`),
        ...program.surfaces.map((surface) => `${surface.role}:${surface.id}`)
      ].sort()
    }
  };
};
