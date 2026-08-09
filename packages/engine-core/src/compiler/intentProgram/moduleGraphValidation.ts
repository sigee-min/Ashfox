import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSpan
} from '../../project/intentProgramTypes';
import { BODY_PORT_CAPACITY, moduleCapability } from './capabilities';
import { intentProgramDiagnostic } from './diagnostics';

export interface ModuleValidationContext {
  readonly modules: ReadonlyMap<string, IntentProgramModule>;
  readonly diagnostics: IntentProgramDiagnostic[];
}

const modulePath = (module: IntentProgramModule): string =>
  `body.${module.id}`;

const structuralHostKinds = new Set(moduleCapability('mass').allowedHosts);

export const isStructuralHost = (
  module: IntentProgramModule | undefined
): boolean => module !== undefined && structuralHostKinds.has(module.kind);

const validateCycles = (
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  const reportedCycles = new Set<string>();
  for (const module of modules.values()) {
    const chain: string[] = [];
    let current: IntentProgramModule | undefined = module;
    while (current && current.kind !== 'core') {
      if (chain.includes(current.id)) {
        const cycle = [...chain.slice(chain.indexOf(current.id)), current.id]
          .sort((left, right) => left.localeCompare(right))
          .join(',');
        if (!reportedCycles.has(cycle)) {
          reportedCycles.add(cycle);
          diagnostics.push(intentProgramDiagnostic(
            sourceMap,
            modulePath(module),
            'intent-program.module-cycle',
            `Body module hosts form a cycle (${cycle}).`
          ));
        }
        break;
      }
      chain.push(current.id);
      current = current.from === undefined
        ? undefined
        : modules.get(current.from);
    }
  }
};

/**
 * A body exterior relation has one structural port. Serial volume must name
 * the first module as its next host; sibling offsets are not a semantic
 * topology and can otherwise produce asymmetric attachment seams later.
 */
const validateBodyPortClaims = (
  modules: ReadonlyMap<string, IntentProgramModule>,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  diagnostics: IntentProgramDiagnostic[]
): void => {
  const claims = new Map<string, IntentProgramModule[]>();
  for (const module of modules.values()) {
    if (module.kind === 'core' || !module.from || !module.extension) continue;
    const key = `${module.from}:${module.extension}`;
    claims.set(key, [...(claims.get(key) ?? []), module]);
  }
  for (const [key, claimants] of claims) {
    const overflow = [...claimants]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(BODY_PORT_CAPACITY);
    for (const module of overflow) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        modulePath(module),
        'intent-program.body-port-capacity-exceeded',
        `Body host face "${key}" has one compiler-owned port. Attach "${module.id}" to the first module when the form is serial, or use a distinct declared direction.`
      ));
    }
  }
};

/** Validates closed body topology before any geometry or seam ownership exists. */
export const validateModuleGraph = (
  program: IntentProgramIr,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): ModuleValidationContext => {
  const diagnostics: IntentProgramDiagnostic[] = [];
  const cores = program.body.filter((module) => module.kind === 'core');
  if (cores.length !== 1) {
    diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      'body',
      'intent-program.root-core',
      'An intent program must declare exactly one core body module.'
    ));
  }
  const modules = new Map<string, IntentProgramModule>();
  for (const module of program.body) {
    if (modules.has(module.id)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        modulePath(module),
        'intent-program.duplicate-module',
        `Body module "${module.id}" is declared more than once.`
      ));
      continue;
    }
    modules.set(module.id, module);
  }
  for (const module of modules.values()) {
    if (module.kind === 'core') continue;
    const capability = moduleCapability(module.kind);
    if (capability.pairing === 'required' && module.configuration !== 'paired') {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        modulePath(module),
        'intent-program.module-configuration-required',
        `Limb and wheel module "${module.id}" must explicitly declare pair.`
      ));
    }
    if (
      program.symmetry === 'bilateral' &&
      capability.pairing === 'required' &&
      module.configuration !== 'paired'
    ) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        modulePath(module),
        'intent-program.unpaired-bilateral-module',
        `Bilateral ${module.kind} module "${module.id}" must declare pair.`
      ));
    }
    if (!module.from || !module.extension) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        modulePath(module),
        'intent-program.incomplete-attached-module',
        `Body module "${module.id}" requires from <module> and extends <direction>.`
      ));
      continue;
    }
    if (!capability.allowedExtensions.includes(module.extension)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `${modulePath(module)}.extension`,
        'intent-program.unsupported-module-extension',
        `Body module "${module.id}" cannot extend ${module.extension}.`
      ));
    }
    if (
      program.symmetry === 'bilateral' &&
      capability.pairing !== 'required' &&
      (module.extension === 'left' || module.extension === 'right')
    ) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `${modulePath(module)}.extension`,
        'intent-program.unpaired-lateral-module',
        `Centered bilateral module "${module.id}" cannot extend ${module.extension}; use a paired topology or a plane-preserving direction.`
      ));
    }
    const parent = modules.get(module.from);
    if (!parent) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `${modulePath(module)}.from`,
        'intent-program.unknown-module-host',
        `Body module "${module.id}" names unknown host "${module.from}".`
      ));
    } else if (!capability.allowedHosts.includes(parent.kind)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap,
        `${modulePath(module)}.from`,
        'intent-program.unsupported-module-host',
        `Body module "${module.id}" cannot attach to ${parent.kind}; its compiler capability requires ${capability.allowedHosts.join(', ')}.`
      ));
    }
  }
  validateBodyPortClaims(modules, sourceMap, diagnostics);
  validateCycles(modules, sourceMap, diagnostics);
  return { modules, diagnostics };
};
