import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSpan
} from '../../project/intentProgramTypes';
import { intentProgramDiagnostic } from './diagnostics';

const modulePath = (module: IntentProgramModule): string =>
  `body.${module.id}`;

export const validateIntentProgramModules = (
  program: IntentProgramIr,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): readonly IntentProgramDiagnostic[] => {
  const diagnostics: IntentProgramDiagnostic[] = [];
  const cores = program.body.filter((module) => module.kind === 'core');
  if (cores.length !== 1) {
    diagnostics.push(intentProgramDiagnostic(
      sourceMap, 'body', 'intent-program.root-core',
      'An intent program must declare exactly one core body module.'
    ));
  }
  const modules = new Map<string, IntentProgramModule>();
  for (const module of program.body) {
    if (modules.has(module.id)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, modulePath(module), 'intent-program.duplicate-module',
        `Body module "${module.id}" is declared more than once.`
      ));
      continue;
    }
    modules.set(module.id, module);
  }
  const hostableKinds = new Set<IntentProgramModule['kind']>([
    'core', 'mass', 'chain', 'radial'
  ]);
  const pairedKinds = new Set<IntentProgramModule['kind']>([
    'limb', 'wheel'
  ]);
  for (const module of modules.values()) {
    if (module.kind === 'core' && (module.from || module.configuration)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, modulePath(module), 'intent-program.root-core-shape',
        'The root core cannot declare a host or pairing mode.'
      ));
    }
    if (!pairedKinds.has(module.kind) && module.configuration !== undefined) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, modulePath(module), 'intent-program.unsupported-module-pairing',
        `Only limb and wheel modules may declare a single or paired configuration; "${module.id}" is compiler-centered.`
      ));
    }
    if (pairedKinds.has(module.kind) && module.configuration === undefined) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, modulePath(module), 'intent-program.module-configuration-required',
        `Limb and wheel module "${module.id}" must explicitly declare single or pair.`
      ));
    }
    if (module.configuration === 'paired' && program.symmetry !== 'bilateral') {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, modulePath(module), 'intent-program.paired-module-requires-bilateral',
        `Paired module "${module.id}" requires bilateral symmetry.`
      ));
    }
    if (
      program.symmetry === 'bilateral' &&
      pairedKinds.has(module.kind) &&
      module.configuration !== 'paired'
    ) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, modulePath(module), 'intent-program.unpaired-bilateral-module',
        `Bilateral ${module.kind} module "${module.id}" must declare pair.`
      ));
    }
    if (module.from && !modules.has(module.from)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, `${modulePath(module)}.from`, 'intent-program.unknown-module-host',
        `Body module "${module.id}" names unknown host "${module.from}".`
      ));
    }
    const parent = module.from ? modules.get(module.from) : undefined;
    if (parent && !hostableKinds.has(parent.kind)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, `${modulePath(module)}.from`, 'intent-program.unsupported-module-host',
        `Body module "${module.id}" must attach to a core, mass, chain, or radial host.`
      ));
    }
  }
  for (const surface of program.surfaces) {
    const host = modules.get(surface.from);
    if (!host) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, `surfaces.${surface.id}.from`, 'intent-program.unknown-surface-host',
        `Surface "${surface.id}" names unknown host "${surface.from}".`
      ));
    } else if (!hostableKinds.has(host.kind)) {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, `surfaces.${surface.id}.from`, 'intent-program.unsupported-surface-host',
        `Surface "${surface.id}" must attach to a core, mass, chain, or radial host.`
      ));
    }
    if (program.face.kind === 'full' && surface.extension === 'forward') {
      diagnostics.push(intentProgramDiagnostic(
        sourceMap, `surfaces.${surface.id}.extension`,
        'intent-program.forward-surface-conflicts-with-face',
        'A full face reserves the anterior plane. Use a nasal/oral face declaration for an anterior form, or use a lateral, up, or rearward surface.'
      ));
    }
  }
  const reportedCycles = new Set<string>();
  for (const module of modules.values()) {
    const chain: string[] = [];
    let current: IntentProgramModule | undefined = module;
    while (current?.from) {
      if (chain.includes(current.id)) {
        const cycle = [...chain.slice(chain.indexOf(current.id)), current.id]
          .sort((left, right) => left.localeCompare(right))
          .join(',');
        if (!reportedCycles.has(cycle)) {
          reportedCycles.add(cycle);
          diagnostics.push(intentProgramDiagnostic(
            sourceMap, modulePath(module), 'intent-program.module-cycle',
            `Body module hosts form a cycle (${cycle}).`
          ));
        }
        break;
      }
      chain.push(current.id);
      current = modules.get(current.from);
    }
  }
  return diagnostics;
};
