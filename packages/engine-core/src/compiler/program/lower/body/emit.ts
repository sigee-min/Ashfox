import type { IntentProgramModule } from '../../../../project/program/types';
import { addAttachedBodyModule, addCore, addRequiredCoreStructure } from './';
import { intentProgramDiagnostic } from '../../diagnostic';
import type { BodyEmissionPort } from '../context';
import type { IntentProgramModuleHost } from '../contract';
import type {
  IntentProgramCompilationPlan,
  IntentProgramLoweringInput
} from '../../contract';

export type BodyEmissionResult =
  | {
      readonly ok: true;
      readonly root: IntentProgramModule;
      readonly rootHost: IntentProgramModuleHost;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReturnType<typeof intentProgramDiagnostic>[];
    };

/** Realizes the planned parent-before-child body graph. */
export const emitIntentProgramBody = (
  context: BodyEmissionPort,
  input: IntentProgramLoweringInput,
  compilation: IntentProgramCompilationPlan
): BodyEmissionResult => {
  const root = compilation.modules[0];
  if (!root) {
    return { ok: false, diagnostics: [intentProgramDiagnostic(
      input.sourceMap, 'body', 'intent-program.root-core',
      'An intent program must declare exactly one core body module.'
    )] };
  }
  const rootPartId = addCore(context, root);
  const rootHost = {
    moduleId: root.id,
    partId: rootPartId,
    slotId: `slot.core.${root.id}`
  };
  context.registerHost(rootHost);
  if (
    input.program.track === 'essential' &&
    input.program.face.kind === 'none' &&
    input.program.body.length === 1 &&
    input.program.support.kind === 'none' &&
    compilation.surfaces.length === 0
  ) {
    addRequiredCoreStructure(
      context, root, rootPartId, rootHost.slotId
    );
  }
  for (const module of compilation.modules.slice(1)) {
    if (module.kind === 'core') {
      return { ok: false, diagnostics: [intentProgramDiagnostic(
        input.sourceMap,
        `body.${module.id}`,
        'intent-program.invalid-attached-module',
        `Body module "${module.id}" cannot be a second core.`
      )] };
    }
    const host = addAttachedBodyModule(
      context,
      module,
      context.requireHost(module.parent)
    );
    if (host) context.registerHost(host);
  }
  return { ok: true, root, rootHost };
};
