import type {
  AuthoringSlotAssignment
} from '../../authoring/authoringTypes';
import type {
  ModelPartFace,
  ModelPartLatticeVec3,
  ModelPartSpec,
  ProjectIntent
} from '../../model';
import { projectSpatialFrame } from '../../project/projectSpatialFrame';
import type { IntentProgramIr } from '../../project/intentProgramTypes';
import type { IntentProgramGraphNode } from './types';
import type { IntentProgramAttachmentReflection } from './types';

export type Side = 'left' | 'right';

/**
 * Exterior body placement is a compiler concern.  The source language names
 * a direction, while this allocator owns the finite, deterministic ports on
 * that exterior.  No caller supplies lattice coordinates.
 */
export const BODY_EXTENSIONS = [
  'forward',
  'rearward',
  'up',
  'down',
  'left',
  'right'
] as const;

export type BodyExtension = (typeof BODY_EXTENSIONS)[number];

export interface IntentProgramBodyPort {
  extension: BodyExtension;
  ordinal: number;
  /** Semantic tangent offsets in local lateral/up/forward coordinates. */
  lateral: number;
  up: number;
  forward: number;
}

/** One concrete limb member that may become a declared standing contact. */
export interface IntentProgramLimbMember {
  side: Side;
  partId: string;
  slotId: string;
  /** Terminal world-space point of the compiler-owned limb segment. */
  endpoint: ModelPartLatticeVec3;
}

/** A named paired limb module, retained so rest support can use it directly. */
export interface IntentProgramLimbPair {
  moduleId: string;
  members: readonly IntentProgramLimbMember[];
}

/** One concrete radial member that may become a declared rolling contact. */
export interface IntentProgramWheelMember {
  side: Side;
  partId: string;
  slotId: string;
}

/** A named paired wheel module retained for typed rolling support. */
export interface IntentProgramWheelPair {
  moduleId: string;
  members: readonly IntentProgramWheelMember[];
}

export interface IntentProgramModuleHost {
  moduleId: string;
  partId: string;
  slotId: string;
}

export const faceByForward: Readonly<Record<ProjectIntent['forward'], ModelPartFace>> = {
  north: 'north', south: 'south', east: 'east', west: 'west'
};

export const attachment = (anchor: ModelPartLatticeVec3) => ({
  parentAnchor: anchor,
  partAnchor: anchor
});

export const sideSymmetry = (pairId: string) => ({ kind: 'paired' as const, pairId });

export const centeredOrAsymmetric = (program: IntentProgramIr) =>
  program.symmetry === 'bilateral'
    ? { kind: 'centered' as const }
    : { kind: 'asymmetric' as const };

export const sideRelation = (side: Side): readonly ('left' | 'right')[] => [side];

export const localPoint = (
  intent: ProjectIntent,
  lateral: number,
  up: number,
  forward: number
): ModelPartLatticeVec3 => {
  const frame = projectSpatialFrame(intent);
  return [
    frame.left[0] * lateral + frame.up[0] * up + frame.forward[0] * forward,
    frame.left[1] * lateral + frame.up[1] * up + frame.forward[1] * forward,
    frame.left[2] * lateral + frame.up[2] * up + frame.forward[2] * forward
  ];
};

/** Converts semantic lateral/up/forward radii into the project lattice axes. */
export const localRadii = (
  intent: ProjectIntent,
  lateral: number,
  up: number,
  forward: number
): ModelPartLatticeVec3 => {
  const frame = projectSpatialFrame(intent);
  return frame.lateralAxis === 'x'
    ? [lateral, up, forward]
    : [forward, up, lateral];
};

const extensionPortOffset = (ordinal: number): number => {
  if (ordinal === 0) return 0;
  const step = Math.ceil(ordinal / 2);
  return (ordinal % 2 === 1 ? 1 : -1) * step * 4;
};

/**
 * Claims one exterior port on a semantic host.  The order is canonicalized
 * by lowering before this function is called, so equivalent source programs
 * get identical layouts regardless of declaration order.
 */
export const allocateBodyPort = (
  state: BuildState,
  parentModuleId: string,
  extension: BodyExtension,
  paired: boolean
): IntentProgramBodyPort => {
  const key = `${parentModuleId}:${extension}`;
  const ordinal = state.bodyPortCounts.get(key) ?? 0;
  state.bodyPortCounts.set(key, ordinal + 1);
  const offset = extensionPortOffset(ordinal);
  // A non-paired structural slot in a bilateral program is centered by
  // contract. Its sibling schedule may only move along axes preserved by the
  // reflection plane; a lateral port shift would make a centered mass/chain/
  // radial fail after compilation despite valid source semantics.
  const preserveBilateralCenter = paired ||
    state.program.symmetry === 'bilateral';
  switch (extension) {
    case 'forward':
    case 'rearward':
      return {
        extension,
        ordinal,
        // A paired module already owns lateral separation through its members;
        // moving the pair together on this axis would destroy exact reflection.
        lateral: preserveBilateralCenter ? 0 : offset,
        up: preserveBilateralCenter ? offset : 0,
        forward: 0
      };
    case 'up':
    case 'down':
      return {
        extension,
        ordinal,
        lateral: preserveBilateralCenter ? 0 : offset,
        up: 0,
        forward: preserveBilateralCenter ? offset : 0
      };
    case 'left':
    case 'right':
      return {
        extension,
        ordinal,
        lateral: 0,
        up: paired ? 0 : Math.trunc(offset / 2),
        forward: offset
      };
  }
};

export const localDirection = (
  intent: ProjectIntent,
  extension: BodyExtension
): ModelPartLatticeVec3 => {
  switch (extension) {
    case 'forward': return localPoint(intent, 0, 0, 1);
    case 'rearward': return localPoint(intent, 0, 0, -1);
    case 'up': return localPoint(intent, 0, 1, 0);
    case 'down': return localPoint(intent, 0, -1, 0);
    case 'left': return localPoint(intent, 1, 0, 0);
    case 'right': return localPoint(intent, -1, 0, 0);
  }
};

export const bodyExtensionSpatialRelation = (
  extension: BodyExtension
): 'left' | 'right' | 'front' | 'rear' | 'above' | 'below' => {
  switch (extension) {
    case 'forward': return 'front';
    case 'rearward': return 'rear';
    case 'up': return 'above';
    case 'down': return 'below';
    case 'left': return 'left';
    case 'right': return 'right';
  }
};

export const compilerPartAnchor = (
  part: ModelPartSpec | undefined,
  fallback: ModelPartLatticeVec3
): ModelPartLatticeVec3 => {
  if (!part) return fallback;
  if (part.kind === 'mass' || part.kind === 'radial') return part.center;
  if (part.kind === 'segment') return part.points[0];
  return fallback;
};

/** Center used for compiler-side exterior port placement. */
export const compilerPartCenter = (
  part: ModelPartSpec | undefined,
  fallback: ModelPartLatticeVec3
): ModelPartLatticeVec3 => {
  if (!part) return fallback;
  if (part.kind === 'mass' || part.kind === 'radial') return part.center;
  if (part.kind === 'segment') return [
    Math.round((part.points[0][0] + part.points[1][0]) / 2),
    Math.round((part.points[0][1] + part.points[1][1]) / 2),
    Math.round((part.points[0][2] + part.points[1][2]) / 2)
  ];
  if (part.kind === 'plate') return part.origin;
  return fallback;
};

const axisForWorldVector = (vector: ModelPartLatticeVec3): 'x' | 'y' | 'z' =>
  vector[0] !== 0 ? 'x' : vector[1] !== 0 ? 'y' : 'z';

/**
 * Conservative half extent of a primitive in a semantic direction.  This is
 * deliberately computed from the actual emitted primitive, not its name, so
 * nested mass, chain, and radial hosts share one port contract.
 */
export const compilerPartDirectionalReach = (
  intent: ProjectIntent,
  part: ModelPartSpec | undefined,
  extension: BodyExtension
): number => {
  if (!part) return 1;
  const direction = localDirection(intent, extension);
  const axis = axisForWorldVector(direction);
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  if (part.kind === 'mass') return part.radii[index];
  if (part.kind === 'radial') {
    return part.axis === axis
      ? Math.max(1, Math.ceil(part.depth / 2))
      : part.outerRadius;
  }
  if (part.kind === 'segment') {
    const center = compilerPartCenter(part, [0, 0, 0]);
    return Math.max(...part.points.map((point, pointIndex) =>
      Math.abs(point[index] - center[index]) +
        part.radii[pointIndex]![index]
    ));
  }
  if (part.kind === 'plate') {
    return part.thickness;
  }
  return 1;
};

/**
 * The compiler's attachment origin for a semantic body module. A chain owns
 * an oriented path, so its forward-most endpoint—not its construction start—
 * is the host for the next semantic module.
 */
export const compilerHostAnchor = (
  intent: ProjectIntent,
  part: ModelPartSpec | undefined,
  fallback: ModelPartLatticeVec3
): ModelPartLatticeVec3 => {
  if (part?.kind !== 'segment') return compilerPartAnchor(part, fallback);
  const forward = projectSpatialFrame(intent).forward;
  return [...part.points].sort((left, right) => {
    const leftDepth = left[0] * forward[0] + left[1] * forward[1] + left[2] * forward[2];
    const rightDepth = right[0] * forward[0] + right[1] * forward[1] + right[2] * forward[2];
    return rightDepth - leftDepth ||
      left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  })[0] ?? fallback;
};

export const compilerPartPlanarReach = (
  part: ModelPartSpec | undefined
): number => {
  if (!part) return 4;
  if (part.kind === 'mass') return Math.max(part.radii[0], part.radii[2]);
  if (part.kind === 'radial') return part.outerRadius;
  if (part.kind === 'segment') return Math.max(...part.radii.map((radius) =>
    Math.max(radius[0], radius[2])
  ));
  return 4;
};

/** Semantic vertical reach used by the compiler's sibling placement policy. */
export const compilerPartVerticalReach = (
  part: ModelPartSpec | undefined
): number => {
  if (!part) return 3;
  if (part.kind === 'mass') return part.radii[1];
  if (part.kind === 'radial') return Math.max(1, Math.ceil(part.depth / 2));
  if (part.kind === 'segment') {
    return Math.max(...part.radii.map((radius) => radius[1]));
  }
  return 1;
};

export interface BuildState {
  readonly program: IntentProgramIr;
  readonly intent: ProjectIntent;
  readonly parts: ModelPartSpec[];
  readonly slots: AuthoringSlotAssignment[];
  readonly graph: IntentProgramGraphNode[];
  /** Paired compiler geometry derives one attachment and reflects it. */
  readonly attachmentReflections: IntentProgramAttachmentReflection[];
  readonly partSlot: Map<string, string>;
  /** Compiler-resolved semantic body hosts; never user-authored part IDs. */
  readonly moduleHosts: Map<string, IntentProgramModuleHost>;
  /** Claimed exterior body ports keyed by parent module and semantic direction. */
  readonly bodyPortCounts: Map<string, number>;
  /** Actual declared paired limbs, later promoted to foot support if selected. */
  readonly limbPairs: Map<string, IntentProgramLimbPair>;
  /** Actual declared paired wheels, later promoted to rolling support if selected. */
  readonly wheelPairs: Map<string, IntentProgramWheelPair>;
}

export const addGraph = (
  state: BuildState,
  node: Omit<IntentProgramGraphNode, 'children'>
): void => {
  state.graph.push({ ...node, children: [] });
};

export const addSlot = (
  state: BuildState,
  slot: AuthoringSlotAssignment
): void => {
  state.slots.push(slot);
  for (const partId of slot.partIds) state.partSlot.set(partId, slot.slotId);
};
