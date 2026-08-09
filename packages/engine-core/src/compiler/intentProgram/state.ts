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

export const compilerPartAnchor = (
  part: ModelPartSpec | undefined,
  fallback: ModelPartLatticeVec3
): ModelPartLatticeVec3 => {
  if (!part) return fallback;
  if (part.kind === 'mass' || part.kind === 'radial') return part.center;
  if (part.kind === 'segment') return part.points[0];
  return fallback;
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
