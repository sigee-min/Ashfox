import {
  CUBE_FACE_DIRECTIONS,
  type CubeFace,
  type CubeFaceDirection,
  type CubeFaces,
  type ProjectDocument,
  type SurfaceTextureDetail
} from '../model';
import type { SceneAxis } from '../commands/types';

export type SurfaceRemapRequest =
  | {
      kind: 'copy';
      targetNodeId: string;
    }
  | {
      kind: 'mirror';
      axis: SceneAxis;
    };

export interface SurfaceRemapResult {
  faces: CubeFaces;
  createdDetailIds: readonly string[];
  changedDetailIds: readonly string[];
}

export const MAX_PROJECT_TEXTURE_DETAILS = 16_384;

export const mapCubeFaces = (
  faces: CubeFaces,
  map: (
    direction: CubeFaceDirection,
    face: CubeFace
  ) => CubeFace
): CubeFaces => ({
  north: map('north', faces.north),
  south: map('south', faces.south),
  east: map('east', faces.east),
  west: map('west', faces.west),
  up: map('up', faces.up),
  down: map('down', faces.down)
});

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

const copyDetailId = (
  detailId: string,
  targetNodeId: string,
  targetFace: CubeFaceDirection
): string => `${detailId}@${targetNodeId}:${targetFace}`;

const mirrorDetail = (
  detail: SurfaceTextureDetail,
  direction: CubeFaceDirection,
  axis: SceneAxis
): SurfaceTextureDetail => {
  const normalized = (value: number): number =>
    Number(value.toFixed(12));
  const flipU =
    axis === 'x' ||
    (
      axis === 'z' &&
      ['north', 'south', 'east', 'west'].includes(direction)
    );
  const flipV =
    axis === 'y' ||
    (
      axis === 'z' &&
      ['up', 'down'].includes(direction)
    );
  return {
    ...detail,
    u: flipU
      ? normalized(1 - detail.u - detail.width)
      : detail.u,
    v: flipV
      ? normalized(1 - detail.v - detail.height)
      : detail.v
  };
};

export const remapCubeSurfaces = (
  faces: CubeFaces,
  request: SurfaceRemapRequest
): SurfaceRemapResult => {
  const createdDetailIds: string[] = [];
  const changedDetailIds: string[] = [];
  const remapped = mapCubeFaces(
    faces,
    (targetDirection) => {
      const sourceDirection = request.kind === 'mirror'
        ? mirroredDirection(targetDirection, request.axis)
        : targetDirection;
      const source = faces[sourceDirection];
      const details = source.details.map((detail) => {
        if (request.kind === 'copy') {
          const id = copyDetailId(
            detail.id,
            request.targetNodeId,
            targetDirection
          );
          createdDetailIds.push(id);
          return { ...detail, id };
        }
        changedDetailIds.push(detail.id);
        return mirrorDetail(detail, sourceDirection, request.axis);
      });
      return {
        ...source,
        ...(request.kind === 'mirror' && source.cullFace
          ? {
              cullFace: mirroredDirection(
                source.cullFace,
                request.axis
              )
            }
          : {}),
        details
      };
    }
  );
  return {
    faces: remapped,
    createdDetailIds,
    changedDetailIds
  };
};

export const projectTextureDetailIds = (
  document: ProjectDocument
): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const texture of Object.values(document.textures)) {
    for (const detail of texture.raster?.canvasDetails ?? []) {
      ids.add(detail.id);
    }
  }
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const face of Object.values(node.faces)) {
      for (const detail of face.details) ids.add(detail.id);
    }
  }
  return ids;
};

export const projectTextureDetailCount = (
  document: ProjectDocument
): number => {
  let count = 0;
  for (const texture of Object.values(document.textures)) {
    if (Array.isArray(texture.raster?.canvasDetails)) {
      count += texture.raster.canvasDetails.length;
    }
  }
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const face of Object.values(node.faces)) {
      if (Array.isArray(face.details)) count += face.details.length;
    }
  }
  return count;
};

export const surfaceDetailIds = (
  faces: CubeFaces
): readonly string[] =>
  CUBE_FACE_DIRECTIONS.flatMap((direction) =>
    faces[direction].details.map((detail) => detail.id)
  );
