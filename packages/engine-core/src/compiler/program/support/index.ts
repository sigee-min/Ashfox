import { intentProgramDiagnostic } from '../diagnostic';
import type { SupportEmissionPort } from '../lower/context';
import {
  addBaseSupport,
  addFootSupports,
  addWheelSupports,
  validateSupportEnvelope
} from './emit';
import type { IntentProgramLoweringInput } from '../contract';

export type SupportRealizationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReturnType<typeof intentProgramDiagnostic>[];
    };

/** Promotes exactly the support set selected by the immutable plan. */
export const realizeIntentProgramSupport = (
  context: SupportEmissionPort,
  input: IntentProgramLoweringInput
): SupportRealizationResult => {
  const envelopeDiagnostics = validateSupportEnvelope(context, input.sourceMap);
  if (envelopeDiagnostics.length > 0) {
    return { ok: false, diagnostics: [...envelopeDiagnostics] };
  }
  const support = context.compilation.support;
  if (support.kind === 'feet') {
    for (const moduleId of support.moduleIds) {
      const limb = context.limbPair(moduleId);
      if (!limb) return unresolved(input, moduleId, 'foot');
      addFootSupports(context, limb);
    }
  } else if (support.kind === 'base') {
    const host = context.host(support.moduleIds[0]);
    if (!host) return unresolved(input, support.moduleIds[0], 'base');
    addBaseSupport(context, host);
  } else if (support.kind === 'wheels') {
    for (const moduleId of support.moduleIds) {
      const wheels = context.wheelPair(moduleId);
      if (!wheels) return unresolved(input, moduleId, 'wheel');
      addWheelSupports(context, wheels);
    }
  }
  return { ok: true };
};

const unresolved = (
  input: IntentProgramLoweringInput,
  moduleId: string,
  kind: 'foot' | 'base' | 'wheel'
): SupportRealizationResult => ({
  ok: false,
  diagnostics: [intentProgramDiagnostic(
    input.sourceMap,
    'support.contacts',
    `intent-program.unresolvable-${kind}-support`,
    `Support module "${moduleId}" did not lower to eligible ${kind} support.`
  )]
});
