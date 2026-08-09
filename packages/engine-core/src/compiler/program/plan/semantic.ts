import type {
  ProjectCanonicalSupport,
  ProjectIntent,
  ProjectSemanticContract,
  ProjectSemanticFace,
  ProjectSupportedSurfaceObligation
} from '../../../model';
import type { IntentProgramIr, IntentProgramSurface } from
  '../../../project/program/types';
import { compareStableText } from '../../../stableOrder';

const supportFor = (program: IntentProgramIr): ProjectCanonicalSupport => {
  switch (program.support.kind) {
    case 'feet': return { kind: 'standing-feet' };
    case 'wheels': return { kind: 'rolling-wheels' };
    case 'base': return { kind: 'supported-base' };
    case 'none': return { kind: 'none' };
  }
};

const faceFor = (program: IntentProgramIr): ProjectSemanticFace => {
  if (program.face.kind === 'none') return { kind: 'none' };
  return {
    kind: 'full',
    eyeConfiguration: program.face.eyes,
    nasal: program.face.nose === 'absent' ? 'absent' : 'present',
    oral: program.face.mouth === 'absent' ? 'absent' : 'present'
  };
};

const surfaceObligation = (
  surface: IntentProgramSurface
): ProjectSupportedSurfaceObligation => ({
  id: surface.id,
  role: surface.role,
  cardinality: surface.cardinality,
  anchor: surface.anchor,
  growth: surface.growth
});

export const projectIntentProgramSemantics = (
  program: IntentProgramIr
): ProjectIntent => {
  const semanticContract: ProjectSemanticContract = {
    subjectDomain: program.domain,
    canonicalSupport: supportFor(program),
    face: faceFor(program),
    supportedSurfaces: program.surfaces
      .map(surfaceObligation)
      .sort((left, right) => compareStableText(left.id, right.id))
  };
  const { palette: _palette, ...appearance } = program.appearance;
  return {
    subject: program.name,
    forward: program.orientation.forward,
    grounding: program.support.kind === 'none' ? 'none' : 'grounded',
    symmetry: program.symmetry === 'bilateral'
      ? { kind: 'bilateral', planeTwice: 0 }
      : program.body.some((module) => module.cardinality === 'paired') ||
          program.surfaces.some((surface) => surface.cardinality === 'paired') ||
          program.face.kind === 'full' && program.face.eyes === 'paired'
        ? { kind: 'asymmetric', pairPlaneTwice: 0 }
        : { kind: 'asymmetric' },
    semanticContract,
    appearance,
    appearanceBindings: [],
    features: [
      ...program.body.map((module) => `${module.kind}:${module.id}`),
      ...program.surfaces.map((surface) => `${surface.role}:${surface.id}`),
      ...(program.focal ? [`focal:${program.focal.id}`] : [])
    ].sort()
  };
};
