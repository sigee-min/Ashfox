import type { AuthoringFaceContract } from '../../../authoring/contract';
import { intentProgramDiagnostic } from '../diagnostic';
import { addFace, addSurface } from '../face/emit';
import { addFocalCue } from '../face/focal';
import type { IntentProgramLoweringContext } from './context';
import type { IntentProgramModuleHost } from './contract';
import type { IntentProgramLoweringInput } from '../contract';

export type PresentationEmissionResult =
  | { readonly ok: true; readonly face: AuthoringFaceContract | null }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReturnType<typeof intentProgramDiagnostic>[];
    };

/** Emits face/focal/surfaces after every structural host is registered. */
export const emitIntentProgramPresentation = (
  context: IntentProgramLoweringContext,
  input: IntentProgramLoweringInput,
  rootHost: IntentProgramModuleHost
): PresentationEmissionResult => {
  const faceHost = input.program.face.kind === 'full'
    ? context.host(input.program.face.parent)
    : rootHost;
  if (input.program.face.kind === 'full' && !faceHost) {
    return { ok: false, diagnostics: [intentProgramDiagnostic(
      input.sourceMap, 'face.parent', 'intent-program.unresolvable-face-host',
      `Face parent "${input.program.face.parent}" did not resolve.`
    )] };
  }
  const face = addFace(context, faceHost ?? rootHost);
  if (input.program.focal) {
    const host = context.host(input.program.focal.parent);
    if (!host) {
      return { ok: false, diagnostics: [intentProgramDiagnostic(
        input.sourceMap, 'focal.parent', 'intent-program.unresolvable-focal-host',
        `Focal parent "${input.program.focal.parent}" did not resolve.`
      )] };
    }
    addFocalCue(context, input.program.focal, host);
  }
  for (const surface of context.compilation.surfaces) {
    const host = context.host(surface.hostModuleId);
    if (!host) {
      return { ok: false, diagnostics: [intentProgramDiagnostic(
        input.sourceMap,
        `${surface.sourcePath}.parent`,
        'intent-program.unresolvable-surface-host',
        `Surface "${surface.id}" did not resolve its structural host.`
      )] };
    }
    addSurface(context, surface, host.partId, host.slotId);
  }
  return { ok: true, face };
};
