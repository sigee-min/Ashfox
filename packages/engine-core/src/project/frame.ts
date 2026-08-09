import type {
  ProjectForwardDirection,
  ProjectIntent,
  Vec3
} from '../model';
import { PART_CONTRACT_LIMITS } from '../modeling/part';

export const PROJECT_SYMMETRY_MAX_PLANE_TWICE =
  PART_CONTRACT_LIMITS.maxAbsoluteCoordinate * 2;

export type ProjectLateralAxis = 'x' | 'z';
export type ProjectLateralSign = -1 | 1;
export type ProjectLateralSide = 'left' | 'center' | 'right';

export interface ProjectSpatialFrame {
  direction: ProjectForwardDirection;
  forward: Vec3;
  up: Vec3;
  left: Vec3;
  right: Vec3;
  lateralAxis: ProjectLateralAxis;
  lateralSign: ProjectLateralSign;
  plane: number | null;
  planeTwice: number | null;
}

/** Reflection plane available to global bilateral or local paired topology. */
export const projectPairPlaneTwice = (
  symmetry: ProjectIntent['symmetry']
): number | null => symmetry.kind === 'bilateral'
  ? symmetry.planeTwice
  : symmetry.pairPlaneTwice ?? null;

const FRAME_BY_FORWARD: Readonly<
  Record<ProjectForwardDirection, Omit<
    ProjectSpatialFrame,
    'direction' | 'plane' | 'planeTwice'
  >>
> = {
  north: {
    forward: [0, 0, -1],
    up: [0, 1, 0],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    lateralAxis: 'x',
    lateralSign: 1
  },
  south: {
    forward: [0, 0, 1],
    up: [0, 1, 0],
    left: [1, 0, 0],
    right: [-1, 0, 0],
    lateralAxis: 'x',
    lateralSign: -1
  },
  east: {
    forward: [1, 0, 0],
    up: [0, 1, 0],
    left: [0, 0, -1],
    right: [0, 0, 1],
    lateralAxis: 'z',
    lateralSign: 1
  },
  west: {
    forward: [-1, 0, 0],
    up: [0, 1, 0],
    left: [0, 0, 1],
    right: [0, 0, -1],
    lateralAxis: 'z',
    lateralSign: -1
  }
};

export const projectSpatialFrame = (
  intent: Pick<ProjectIntent, 'forward' | 'symmetry'>
): ProjectSpatialFrame => {
  const basis = FRAME_BY_FORWARD[intent.forward];
  const planeTwice = projectPairPlaneTwice(intent.symmetry);
  return {
    direction: intent.forward,
    ...basis,
    plane: planeTwice === null ? null : planeTwice / 2,
    planeTwice
  };
};

const axisIndex = (axis: ProjectLateralAxis): 0 | 2 =>
  axis === 'x' ? 0 : 2;

const requiredPlaneTwice = (frame: ProjectSpatialFrame): number => {
  if (frame.planeTwice === null) {
    throw new RangeError(
      'A bilateral project symmetry plane is required for reflection.'
    );
  }
  return frame.planeTwice;
};

const withLateralCoordinate = (
  value: Vec3,
  frame: ProjectSpatialFrame,
  coordinate: number
): Vec3 => {
  const reflected: [number, number, number] = [...value];
  reflected[axisIndex(frame.lateralAxis)] = coordinate;
  return reflected;
};

/** Reflects a lattice vertex or authored point across the project plane. */
export const reflectProjectPoint = (
  point: Vec3,
  frame: ProjectSpatialFrame
): Vec3 => {
  const index = axisIndex(frame.lateralAxis);
  return withLateralCoordinate(
    point,
    frame,
    requiredPlaneTwice(frame) - point[index]
  );
};

/** Reflects the minimum coordinate of one unit lattice cell. */
export const reflectProjectCell = (
  cell: Vec3,
  frame: ProjectSpatialFrame
): Vec3 => {
  const index = axisIndex(frame.lateralAxis);
  return withLateralCoordinate(
    cell,
    frame,
    requiredPlaneTwice(frame) - cell[index] - 1
  );
};

const sideFromSignedDistance = (distance: number): ProjectLateralSide =>
  distance < 0 ? 'left' : distance > 0 ? 'right' : 'center';

/** Classifies a lattice vertex relative to the semantic left/right frame. */
export const projectPointLateralSide = (
  point: Vec3,
  frame: ProjectSpatialFrame
): ProjectLateralSide => {
  const coordinate = point[axisIndex(frame.lateralAxis)];
  const distanceTwice = frame.lateralSign * (
    2 * coordinate - requiredPlaneTwice(frame)
  );
  return sideFromSignedDistance(distanceTwice);
};

/** Classifies a unit lattice cell by its center relative to the project plane. */
export const projectCellLateralSide = (
  cell: Vec3,
  frame: ProjectSpatialFrame
): ProjectLateralSide => {
  const coordinate = cell[axisIndex(frame.lateralAxis)];
  const distanceTwice = frame.lateralSign * (
    2 * coordinate + 1 - requiredPlaneTwice(frame)
  );
  return sideFromSignedDistance(distanceTwice);
};
