import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSpan
} from '../../project/intentProgramTypes';
import { SURFACE_PORT_CAPACITY } from './capabilities';
import { intentProgramDiagnostic } from './diagnostics';
import { isStructuralHost } from './moduleGraphValidation';

const isPairedTopology = (
  module: IntentProgramModule | undefined,
  kind: 'limb' | 'wheel'
): boolean => module?.kind === kind && module.configuration === 'paired';

const validateRestSupport = (
  program: IntentProgramIr,
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  const restSupport = program.rest.kind === 'airborne'
    ? undefined
    : modules.get(program.rest.on);
  if (program.rest.kind === 'feet') {
    if (!isPairedTopology(restSupport, 'limb')) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        'rest.on',
        'intent-program.feet-require-paired-limb',
        'Neutral feet must name one declared paired limb module.'
      ));
    } else if (restSupport?.extension !== 'down') {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        'rest.on',
        'intent-program.feet-require-downward-limb',
        'Neutral feet require a paired limb that extends down from its structural host.'
      ));
    }
  }
  if (program.rest.kind === 'base' && !isStructuralHost(restSupport)) {
    diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      'rest.on',
      'intent-program.base-requires-structural-host',
      'Base support must name a core, mass, chain, or radial structural host.'
    ));
  }
  if (program.rest.kind === 'wheels') {
    if (!isPairedTopology(restSupport, 'wheel')) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        'rest.on',
        'intent-program.wheels-require-paired-wheel',
        'Neutral wheels must name one declared paired wheel module.'
      ));
    } else if (restSupport?.extension !== 'down') {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        'rest.on',
        'intent-program.wheels-require-downward-wheel',
        'Neutral wheels require a paired wheel module that extends down from its structural host.'
      ));
    }
  }
};

/**
 * `wheel` is not a decorative radial alias: it has a compiler-owned ground
 * contact and rolling rest contract. A non-grounded rotary form is expressed
 * by `radial`, so it cannot reach attachment/materialization as a fake wheel.
 */
const validateWheelOwnership = (
  program: IntentProgramIr,
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  for (const module of modules.values()) {
    if (module.kind !== 'wheel') continue;
    if (program.rest.kind === 'wheels' && program.rest.on === module.id) {
      continue;
    }
    diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      `body.${module.id}`,
      'intent-program.wheel-requires-rolling-rest',
      `Wheel module "${module.id}" is a grounded rolling topology and must be selected by rest neutral wheels on ${module.id}; use radial for a non-grounded rotary form.`
    ));
  }
};

const validateFaceAndFocal = (
  program: IntentProgramIr,
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  if (program.face.kind === 'full' && !isStructuralHost(modules.get(program.face.on))) {
    diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      'face.on',
      'intent-program.face-requires-structural-host',
      `Face host "${program.face.on}" must name a core, mass, chain, or radial structural host.`
    ));
  }
  if (program.focal && !isStructuralHost(modules.get(program.focal.on))) {
    diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      'focal.on',
      'intent-program.focal-requires-structural-host',
      `Focal host "${program.focal.on}" must name a core, mass, chain, or radial structural host.`
    ));
  }
  if (program.track === 'hero' && program.face.kind === 'none' && !program.focal) {
    diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      'focal',
      'intent-program.hero-requires-focal-stage',
      'Hero track without a face must declare one focal stage module.'
    ));
  }
};

const validateSurfaces = (
  program: IntentProgramIr,
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  const claims = new Map<string, typeof program.surfaces>();
  for (const surface of program.surfaces) {
    const host = modules.get(surface.from);
    if (!host) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `surfaces.${surface.id}.from`,
        'intent-program.unknown-surface-host',
        `Surface "${surface.id}" names unknown host "${surface.from}".`
      ));
    } else if (!isStructuralHost(host)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `surfaces.${surface.id}.from`,
        'intent-program.unsupported-surface-host',
        `Surface "${surface.id}" must attach to a core, mass, chain, or radial host.`
      ));
    }
    if (program.face.kind === 'full' && surface.extension === 'forward') {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `surfaces.${surface.id}.extension`,
        'intent-program.forward-surface-conflicts-with-face',
        'A full face reserves the canonical anterior stage. Use a lateral, up, or rearward surface, or model the form as a body chain instead.'
      ));
    }
    const key = `${surface.from}:${surface.extension}`;
    claims.set(key, [...(claims.get(key) ?? []), surface]);
  }
  for (const [key, claimants] of claims) {
    const overflow = [...claimants]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(SURFACE_PORT_CAPACITY);
    for (const surface of overflow) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `surfaces.${surface.id}.extension`,
        'intent-program.surface-port-capacity-exceeded',
        `Surface host face "${key}" has only ${SURFACE_PORT_CAPACITY} compiler-owned ports; remove or relocate "${surface.id}".`
      ));
    }
  }
};

/** Validates support and presentation topology after the body graph is closed. */
export const validateModuleTopology = (
  program: IntentProgramIr,
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  validateRestSupport(program, modules, sourceMap, diagnostics);
  validateWheelOwnership(program, modules, sourceMap, diagnostics);
  validateFaceAndFocal(program, modules, sourceMap, diagnostics);
  validateSurfaces(program, modules, sourceMap, diagnostics);
};
