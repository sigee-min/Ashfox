import type {
  CubeFaceDirection,
  CubeFaces,
  CubeNode,
  ProjectDocument,
  SceneNode,
  Vec3
} from '../../model';
import type { SceneAxis } from '../types';

export const axisIndex = (axis: SceneAxis): 0 | 1 | 2 => {
  switch (axis) {
    case 'x':
      return 0;
    case 'y':
      return 1;
    case 'z':
      return 2;
  }
};

export const offsetVec3 = (value: Vec3, offset: Vec3): Vec3 => [
  value[0] + offset[0],
  value[1] + offset[1],
  value[2] + offset[2]
];

const mirroredDirection = (
  direction: CubeFaceDirection,
  axis: SceneAxis
): CubeFaceDirection => {
  if (axis === 'x') {
    if (direction === 'east') return 'west';
    if (direction === 'west') return 'east';
  }
  if (axis === 'y') {
    if (direction === 'up') return 'down';
    if (direction === 'down') return 'up';
  }
  if (axis === 'z') {
    if (direction === 'north') return 'south';
    if (direction === 'south') return 'north';
  }
  return direction;
};

export const mirrorCubeFaces = (
  faces: CubeFaces,
  axis: SceneAxis
): CubeFaces => {
  const faceFor = (targetDirection: CubeFaceDirection) => {
    const source = faces[mirroredDirection(targetDirection, axis)];
    return {
      ...source,
      ...(source.cullFace
        ? { cullFace: mirroredDirection(source.cullFace, axis) }
        : {})
    };
  };
  return {
    north: faceFor('north'),
    south: faceFor('south'),
    east: faceFor('east'),
    west: faceFor('west'),
    up: faceFor('up'),
    down: faceFor('down')
  };
};

export const cloneCube = (
  source: CubeNode,
  id: string,
  name: string,
  offset: Vec3
): CubeNode => ({
  ...source,
  id,
  name,
  transform: {
    ...source.transform,
    pivot: offsetVec3(source.transform.pivot, offset)
  },
  bounds: {
    from: offsetVec3(source.bounds.from, offset),
    to: offsetVec3(source.bounds.to, offset)
  },
  faces: {
    north: { ...source.faces.north },
    south: { ...source.faces.south },
    east: { ...source.faces.east },
    west: { ...source.faces.west },
    up: { ...source.faces.up },
    down: { ...source.faces.down }
  }
});

export const findMissingNodeId = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): string | undefined =>
  nodeIds.find((nodeId) => !document.scene.nodes[nodeId]);

export const findNonCube = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): SceneNode | undefined =>
  nodeIds
    .map((nodeId) => document.scene.nodes[nodeId])
    .find((node) => node?.kind !== 'cube');
