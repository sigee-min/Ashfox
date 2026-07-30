import {
  assertLatticePoint,
  assertPositiveLatticePoint,
  createOccupancyGrid
} from './lattice';
import { profileExponent, superellipsoidScore } from './profile';
import type {
  LatticePoint,
  OccupancyGrid,
  RasterSegmentControlPoint,
  RasterSegmentPrimitive,
  SurfacePixelDensity
} from './types';

const INCLUSION_EPSILON = 1e-12;

type ContinuousPoint = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

const subtract = (
  left: ContinuousPoint,
  right: ContinuousPoint
): ContinuousPoint => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z
});

const dot = (left: ContinuousPoint, right: ContinuousPoint): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const interpolate = (
  start: ContinuousPoint,
  end: ContinuousPoint,
  t: number
): ContinuousPoint => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
  z: start.z + (end.z - start.z) * t
});

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const validateControlPoints = (
  points: readonly RasterSegmentControlPoint[]
): void => {
  if (points.length < 2 || points.length > 8) {
    throw new RangeError('segment.points must contain between 2 and 8 points');
  }
  points.forEach((point, index) => {
    assertLatticePoint(point.position, `segment.points[${index}].position`);
    assertPositiveLatticePoint(
      point.radii,
      `segment.points[${index}].radii`
    );
    if (index === 0) {
      return;
    }
    const previous = points[index - 1].position;
    if (
      previous.x === point.position.x &&
      previous.y === point.position.y &&
      previous.z === point.position.z
    ) {
      throw new RangeError('adjacent segment control points must be distinct');
    }
  });
};

const segmentScore = (
  sample: ContinuousPoint,
  start: RasterSegmentControlPoint,
  end: RasterSegmentControlPoint,
  exponent: 2 | 4 | 8
): number => {
  const direction = subtract(end.position, start.position);
  const offset = subtract(sample, start.position);
  const lengthSquared = dot(direction, direction);
  const t = clampUnit(dot(offset, direction) / lengthSquared);
  const nearest = interpolate(start.position, end.position, t);
  const radii = interpolate(start.radii, end.radii, t);
  return superellipsoidScore(subtract(sample, nearest), radii, exponent);
};

const coordinateBounds = (
  points: readonly RasterSegmentControlPoint[],
  axis: 'x' | 'y' | 'z'
): readonly [number, number] => [
  Math.min(...points.map((point) => point.position[axis] - point.radii[axis])),
  Math.max(...points.map((point) => point.position[axis] + point.radii[axis]))
];

export const rasterizeSegment = (
  density: SurfacePixelDensity,
  spec: RasterSegmentPrimitive
): OccupancyGrid => {
  validateControlPoints(spec.points);
  const exponent = profileExponent(spec.profile);
  const [minX, maxX] = coordinateBounds(spec.points, 'x');
  const [minY, maxY] = coordinateBounds(spec.points, 'y');
  const [minZ, maxZ] = coordinateBounds(spec.points, 'z');
  const cells: LatticePoint[] = [];

  for (let x = minX; x < maxX; x += 1) {
    for (let y = minY; y < maxY; y += 1) {
      for (let z = minZ; z < maxZ; z += 1) {
        const sample = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
        let occupied = false;
        for (let index = 1; index < spec.points.length; index += 1) {
          if (
            segmentScore(
              sample,
              spec.points[index - 1],
              spec.points[index],
              exponent
            ) <=
            1 + INCLUSION_EPSILON
          ) {
            occupied = true;
            break;
          }
        }
        if (occupied) {
          cells.push({ x, y, z });
        }
      }
    }
  }

  return createOccupancyGrid(density, cells);
};
