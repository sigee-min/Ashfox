import type {
  CubeFaceDirection,
  ProjectDocument,
  Vec3
} from '../../model';
import type { LatticeBounds } from '../../modeling/contract';
import { projectSpatialFrame } from '../../project/frame';
import type {
  SurfaceAppearanceProjectFrame,
  SurfaceFaceAspect
} from './contract';

const FACE_NORMALS: Readonly<Record<CubeFaceDirection, Vec3>> = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0]
};

const fallbackFrame = {
  forward: [0, 0, -1],
  left: [-1, 0, 0],
  up: [0, 1, 0]
} as const;

const dot = (left: Vec3, right: Vec3): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const frozenVec3 = (value: Vec3): Vec3 => Object.freeze([
  value[0],
  value[1],
  value[2]
]);

const corners = (bounds: LatticeBounds): readonly Vec3[] => [
  [bounds.min.x, bounds.min.y, bounds.min.z],
  [bounds.min.x, bounds.min.y, bounds.max.z],
  [bounds.min.x, bounds.max.y, bounds.min.z],
  [bounds.min.x, bounds.max.y, bounds.max.z],
  [bounds.max.x, bounds.min.y, bounds.min.z],
  [bounds.max.x, bounds.min.y, bounds.max.z],
  [bounds.max.x, bounds.max.y, bounds.min.z],
  [bounds.max.x, bounds.max.y, bounds.max.z]
];

const rangeAlong = (points: readonly Vec3[], axis: Vec3) => {
  const values = points.map((point) => dot(point, axis));
  return Object.freeze({
    minimum: Math.min(...values),
    maximum: Math.max(...values)
  });
};

export const createSurfaceAppearanceFrame = (
  document: ProjectDocument,
  bounds: LatticeBounds
): SurfaceAppearanceProjectFrame => {
  const frame = document.intent
    ? projectSpatialFrame(document.intent)
    : fallbackFrame;
  const points = corners(bounds);
  return Object.freeze({
    forward: frozenVec3(frame.forward),
    left: frozenVec3(frame.left),
    up: frozenVec3(frame.up),
    lateralRange: rangeAlong(points, frame.left),
    upRange: rangeAlong(points, frame.up),
    forwardRange: rangeAlong(points, frame.forward)
  });
};

export const surfaceFaceAspect = (
  direction: CubeFaceDirection,
  frame: SurfaceAppearanceProjectFrame
): SurfaceFaceAspect => {
  const normal = FACE_NORMALS[direction];
  const up = dot(normal, frame.up);
  if (up > 0.5) return 'dorsal';
  if (up < -0.5) return 'ventral';
  const forward = dot(normal, frame.forward);
  if (forward > 0.5) return 'anterior';
  if (forward < -0.5) return 'posterior';
  return 'flank';
};
