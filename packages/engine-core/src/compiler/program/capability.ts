import type { AuthoringStructuralRole } from '../../authoring/contract';
import type { IntentProgramModuleKind } from '../../project/program/types';

/** Geometry lowering maps each resolved module kind to one authoring role. */
export const INTENT_PROGRAM_MODULE_STRUCTURAL_ROLES: Readonly<
  Record<IntentProgramModuleKind, AuthoringStructuralRole>
> = Object.freeze({
  core: 'core',
  mass: 'core',
  chain: 'axis',
  limb: 'articulated',
  wheel: 'rotary',
  radial: 'rotary'
});

export const moduleStructuralRole = (
  kind: IntentProgramModuleKind
): AuthoringStructuralRole => INTENT_PROGRAM_MODULE_STRUCTURAL_ROLES[kind];
