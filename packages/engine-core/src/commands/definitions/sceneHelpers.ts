import type {
  CubeNode,
  ProjectDocument,
  SceneNode,
  Vec3
} from '../../model';
import { remapCubeSurfaces } from '../../textures/surfaceDetails';
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
  faces: remapCubeSurfaces(source.faces, {
    kind: 'copy',
    targetNodeId: id
  }).faces
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
