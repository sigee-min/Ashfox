import type { AuthoringStructuralRole } from '../../authoring/authoringTypes';
import type {
  IntentProgramModuleKind,
  IntentProgramModuleExtension,
  IntentProgramSurfaceExtension
} from '../../project/intentProgramTypes';

export interface IntentProgramModuleCapability {
  readonly structuralRole: AuthoringStructuralRole;
  readonly allowedHosts: readonly IntentProgramModuleKind[];
  readonly pairing: 'forbidden' | 'optional' | 'required';
  readonly allowedExtensions: readonly IntentProgramModuleExtension[];
}

const ATTACHED_DIRECTIONS: readonly IntentProgramModuleExtension[] = [
  'forward', 'rearward', 'up', 'down', 'left', 'right'
];

/**
 * One capability authority shared by syntax validation and lowering. A module
 * can only be admitted when the compiler has a structural role, host class,
 * pairing contract, and direction implementation for it.
 */
export const INTENT_PROGRAM_MODULE_CAPABILITIES: Readonly<
  Record<IntentProgramModuleKind, IntentProgramModuleCapability>
> = {
  core: {
    structuralRole: 'core',
    allowedHosts: [],
    pairing: 'forbidden',
    allowedExtensions: []
  },
  mass: {
    structuralRole: 'core',
    allowedHosts: ['core', 'mass', 'chain', 'radial'],
    pairing: 'forbidden',
    allowedExtensions: ATTACHED_DIRECTIONS
  },
  chain: {
    structuralRole: 'axis',
    allowedHosts: ['core', 'mass', 'chain', 'radial'],
    pairing: 'forbidden',
    allowedExtensions: ATTACHED_DIRECTIONS
  },
  limb: {
    structuralRole: 'articulated',
    allowedHosts: ['core', 'mass', 'chain', 'radial'],
    pairing: 'required',
    // A paired topology cannot meaningfully extend as one single lateral
    // direction; both sides would then claim incompatible semantics.
    allowedExtensions: ['down', 'forward', 'rearward', 'up']
  },
  wheel: {
    structuralRole: 'rotary',
    allowedHosts: ['core', 'mass', 'chain', 'radial'],
    pairing: 'required',
    // A wheel module is a grounded rolling topology. Other radial forms use
    // the explicit `radial` module instead of pretending to be wheels.
    allowedExtensions: ['down']
  },
  radial: {
    structuralRole: 'rotary',
    allowedHosts: ['core', 'mass', 'chain', 'radial'],
    pairing: 'forbidden',
    allowedExtensions: ATTACHED_DIRECTIONS
  }
};

export const moduleCapability = (
  kind: IntentProgramModuleKind
): IntentProgramModuleCapability => INTENT_PROGRAM_MODULE_CAPABILITIES[kind];

export const PAIR_SURFACE_EXTENSIONS: readonly IntentProgramSurfaceExtension[] = [
  'lateral', 'up', 'forward', 'rearward'
];

export const SINGLE_SURFACE_EXTENSIONS: readonly IntentProgramSurfaceExtension[] = [
  'left', 'right', 'up', 'forward', 'rearward'
];

/** Each semantic host face has two compiler-owned surface ports. */
export const SURFACE_PORT_CAPACITY = 2;

/**
 * A structural host face admits one body module. Additional serial volume is
 * expressed by naming that module as the next host, never by relying on an
 * arbitrary sibling offset that can change attachment seam ownership.
 */
export const BODY_PORT_CAPACITY = 1;
