import type {
  ModelPartFace,
  ModelPartLatticeVec3,
  ModelPartSpec,
  ProjectIntent
} from '../../../model';
import { projectSpatialFrame } from '../../../project/frame';
import type {
  IntentProgramAttachmentAnchor,
  IntentProgramGrowthDirection,
  IntentProgramIr
} from '../../../project/program/types';
import type { Side } from './contract';

export type IntentProgramAxisDirection = Exclude<
  IntentProgramGrowthDirection,
  'outward'
>;

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

export const localDirection = (
  intent: ProjectIntent,
  direction: IntentProgramAxisDirection
): ModelPartLatticeVec3 => {
  switch (direction) {
    case 'forward': return localPoint(intent, 0, 0, 1);
    case 'rearward': return localPoint(intent, 0, 0, -1);
    case 'up': return localPoint(intent, 0, 1, 0);
    case 'down': return localPoint(intent, 0, -1, 0);
    case 'left': return localPoint(intent, 1, 0, 0);
    case 'right': return localPoint(intent, -1, 0, 0);
  }
};

export const bodyGrowthSpatialRelation = (
  growth: IntentProgramAxisDirection
): 'left' | 'right' | 'front' | 'rear' | 'above' | 'below' => {
  switch (growth) {
    case 'forward': return 'front';
    case 'rearward': return 'rear';
    case 'up': return 'above';
    case 'down': return 'below';
    case 'left': return 'left';
    case 'right': return 'right';
  }
};

export const anchorDirection = (
  anchor: Exclude<IntentProgramAttachmentAnchor, 'sides'>
): IntentProgramAxisDirection => {
  switch (anchor) {
    case 'front': return 'forward';
    case 'rear': return 'rearward';
    case 'top': return 'up';
    case 'bottom': return 'down';
    case 'left': return 'left';
    case 'right': return 'right';
  }
};

export const memberGrowthDirection = (
  growth: IntentProgramGrowthDirection,
  side: Side
): IntentProgramAxisDirection => growth === 'outward' ? side : growth;

export const compilerPartAnchor = (
  part: ModelPartSpec | undefined,
  fallback: ModelPartLatticeVec3
): ModelPartLatticeVec3 => {
  if (!part) return fallback;
  if (part.kind === 'mass' || part.kind === 'radial') return part.center;
  if (part.kind === 'segment') return part.points[0];
  return fallback;
};

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

export const compilerPartDirectionalReach = (
  intent: ProjectIntent,
  part: ModelPartSpec | undefined,
  direction: IntentProgramAxisDirection
): number => {
  if (!part) return 1;
  const vector = localDirection(intent, direction);
  const axis = axisForWorldVector(vector);
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
      Math.abs(point[index] - center[index]) + part.radii[pointIndex]![index]
    ));
  }
  if (part.kind === 'plate') return part.thickness;
  return 1;
};

export const compilerHostAnchor = (
  intent: ProjectIntent,
  part: ModelPartSpec | undefined,
  fallback: ModelPartLatticeVec3
): ModelPartLatticeVec3 => {
  if (part?.kind !== 'segment') return compilerPartAnchor(part, fallback);
  const forward = projectSpatialFrame(intent).forward;
  return [...part.points].sort((left, right) => {
    const leftDepth = left[0] * forward[0] + left[1] * forward[1] +
      left[2] * forward[2];
    const rightDepth = right[0] * forward[0] + right[1] * forward[1] +
      right[2] * forward[2];
    return rightDepth - leftDepth || left[0] - right[0] ||
      left[1] - right[1] || left[2] - right[2];
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
