import type { ModelPartFace } from '../../model';
import type {
  LatticeVec2,
  LatticeVec3,
  PartSpec
} from '../partContract';
import { cellKey, parseCellKey } from '../lattice';
import { surfaceFeatureAxes } from '../surfaceFeature';
import type {
  Axis,
  CellKey,
  LatticePoint
} from '../types';

const AXIS_INDEX: Readonly<Record<Axis, 0 | 1 | 2>> = {
  x: 0,
  y: 1,
  z: 2
};

const vec3WithCoordinate = (
  value: LatticeVec3,
  axis: Axis,
  coordinate: number
): LatticeVec3 => {
  const next: [number, number, number] = [...value];
  next[AXIS_INDEX[axis]] = coordinate;
  return next;
};

export const addVec3 = (
  left: LatticeVec3,
  right: LatticeVec3
): LatticeVec3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2]
];

export const reflectPoint = (
  value: LatticeVec3,
  axis: Axis,
  plane: number
): LatticeVec3 => {
  const index = AXIS_INDEX[axis];
  return vec3WithCoordinate(value, axis, plane * 2 - value[index]);
};

export const translatePrimitive = (
  part: PartSpec,
  translation: LatticeVec3
): PartSpec => {
  switch (part.kind) {
    case 'mass':
      return { ...part, center: addVec3(part.center, translation) };
    case 'segment':
      return {
        ...part,
        points: part.points.map((point) => addVec3(point, translation))
      };
    case 'plate':
      return { ...part, origin: addVec3(part.origin, translation) };
    case 'radial':
      return { ...part, center: addVec3(part.center, translation) };
    case 'feature':
      return { ...part, anchor: addVec3(part.anchor, translation) };
  }
};

const plateAxes = (
  plane: Extract<PartSpec, { kind: 'plate' }>['plane']
): { normal: Axis; u: Axis; v: Axis } => {
  if (plane === 'xy') return { normal: 'z', u: 'x', v: 'y' };
  if (plane === 'xz') return { normal: 'y', u: 'x', v: 'z' };
  return { normal: 'x', u: 'y', v: 'z' };
};

const reflectOutlineCoordinate = (
  outline: readonly LatticeVec2[],
  coordinate: 0 | 1
): readonly LatticeVec2[] =>
  outline.map((point) => {
    const next: [number, number] = [...point];
    next[coordinate] = -next[coordinate];
    return next;
  });

const reflectedPlate = (
  part: Extract<PartSpec, { kind: 'plate' }>,
  axis: Axis
): PartSpec => {
  const axes = plateAxes(part.plane);
  const index = AXIS_INDEX[axis];
  if (axis === axes.normal) {
    return {
      ...part,
      origin: vec3WithCoordinate(
        part.origin,
        axis,
        -part.origin[index] - part.thickness
      )
    };
  }
  return {
    ...part,
    origin: vec3WithCoordinate(part.origin, axis, -part.origin[index]),
    outline: reflectOutlineCoordinate(
      part.outline,
      axis === axes.u ? 0 : 1
    )
  };
};

const oppositeFace = (face: ModelPartFace): ModelPartFace => {
  switch (face) {
    case 'north': return 'south';
    case 'south': return 'north';
    case 'east': return 'west';
    case 'west': return 'east';
    case 'up': return 'down';
    case 'down': return 'up';
  }
};

export const reflectedFeature = (
  part: Extract<PartSpec, { kind: 'feature' }>,
  axis: Axis,
  plane: number
): Extract<PartSpec, { kind: 'feature' }> => {
  const axes = surfaceFeatureAxes(part.face);
  const index = AXIS_INDEX[axis];
  if (axis === axes.normal) {
    return {
      ...part,
      face: oppositeFace(part.face),
      anchor: vec3WithCoordinate(
        part.anchor,
        axis,
        plane * 2 - part.anchor[index]
      )
    };
  }
  const size = part.size[axis === axes.u ? 0 : 1];
  return {
    ...part,
    anchor: vec3WithCoordinate(
      part.anchor,
      axis,
      plane * 2 - part.anchor[index] + 2 * Math.floor(size / 2) - size
    )
  };
};

export const reflectedPrimitive = (
  part: PartSpec,
  axis: Axis
): PartSpec => {
  const index = AXIS_INDEX[axis];
  switch (part.kind) {
    case 'mass':
      return {
        ...part,
        center: vec3WithCoordinate(part.center, axis, -part.center[index])
      };
    case 'segment':
      return {
        ...part,
        points: part.points.map((point) =>
          vec3WithCoordinate(point, axis, -point[index])
        )
      };
    case 'plate':
      return reflectedPlate(part, axis);
    case 'radial': {
      if (part.axis !== axis) {
        return {
          ...part,
          center: vec3WithCoordinate(part.center, axis, -part.center[index])
        };
      }
      const halfDepth = Math.floor(part.depth / 2);
      return {
        ...part,
        center: vec3WithCoordinate(
          part.center,
          axis,
          -part.center[index] + 2 * halfDepth - part.depth
        )
      };
    }
    case 'feature':
      return part;
  }
};

export const reflectLatticeCell = (
  cell: LatticePoint,
  axis: Axis,
  plane: number
): LatticePoint => ({
  ...cell,
  [axis]: plane * 2 - cell[axis] - 1
});

export const areLatticeCellSetsExactReflections = (
  source: ReadonlySet<CellKey>,
  target: ReadonlySet<CellKey>,
  axis: Axis,
  plane: number
): boolean => {
  if (source.size !== target.size) return false;
  for (const key of source) {
    const reflected = cellKey(
      reflectLatticeCell(parseCellKey(key), axis, plane)
    );
    if (!target.has(reflected)) return false;
  }
  return true;
};
