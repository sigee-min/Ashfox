import {
  assertLatticeInteger,
  assertPlanePoint,
  createOccupancyGrid,
  pointFromPlane
} from './lattice';
import type {
  LatticePoint,
  OccupancyGrid,
  PlanePoint,
  RasterPlatePrimitive,
  RasterPlateShape,
  SurfacePixelDensity
} from './types';

const INCLUSION_EPSILON = 1e-12;

const subtract = (left: PlanePoint, right: PlanePoint): PlanePoint => ({
  u: left.u - right.u,
  v: left.v - right.v
});

const cross = (left: PlanePoint, right: PlanePoint): number =>
  left.u * right.v - left.v * right.u;

const edge = (start: PlanePoint, end: PlanePoint): PlanePoint =>
  subtract(end, start);

const rectangleVertices = (
  shape: Extract<RasterPlateShape, { kind: 'rectangle' }>
): readonly [PlanePoint, PlanePoint, PlanePoint, PlanePoint] => {
  assertPlanePoint(shape.min, 'plate.shape.min');
  assertPlanePoint(shape.max, 'plate.shape.max');
  if (shape.min.u >= shape.max.u || shape.min.v >= shape.max.v) {
    throw new RangeError('rectangle plate must have positive width and height');
  }
  return [
    { u: shape.min.u, v: shape.min.v },
    { u: shape.max.u, v: shape.min.v },
    { u: shape.max.u, v: shape.max.v },
    { u: shape.min.u, v: shape.max.v }
  ];
};

const assertStrictlyConvex = (vertices: readonly PlanePoint[]): void => {
  let orientation = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const after = vertices[(index + 2) % vertices.length];
    const turn = cross(edge(current, next), edge(next, after));
    if (turn === 0) {
      throw new RangeError('plate vertices must form a strictly convex polygon');
    }
    const sign = Math.sign(turn);
    if (orientation === 0) {
      orientation = sign;
    } else if (sign !== orientation) {
      throw new RangeError(
        'plate vertices must be ordered around a convex polygon'
      );
    }
  }
};

const assertTrapezoid = (
  vertices: readonly [PlanePoint, PlanePoint, PlanePoint, PlanePoint]
): void => {
  const edges = vertices.map((vertex, index) =>
    edge(vertex, vertices[(index + 1) % vertices.length])
  );
  const hasParallelOppositePair =
    cross(edges[0], edges[2]) === 0 || cross(edges[1], edges[3]) === 0;
  if (!hasParallelOppositePair) {
    throw new RangeError(
      'trapezoid plate must have at least one parallel opposite edge pair'
    );
  }
};

const shapeVertices = (shape: RasterPlateShape): readonly PlanePoint[] => {
  if (shape.kind === 'rectangle') {
    return rectangleVertices(shape);
  }
  shape.vertices.forEach((vertex, index) => {
    assertPlanePoint(vertex, `plate.shape.vertices[${index}]`);
  });
  assertStrictlyConvex(shape.vertices);
  if (shape.kind === 'trapezoid') {
    assertTrapezoid(shape.vertices);
  }
  return shape.vertices;
};

const containsPoint = (
  vertices: readonly PlanePoint[],
  point: PlanePoint
): boolean => {
  let hasPositive = false;
  let hasNegative = false;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const side = cross(edge(start, end), subtract(point, start));
    hasPositive ||= side > INCLUSION_EPSILON;
    hasNegative ||= side < -INCLUSION_EPSILON;
    if (hasPositive && hasNegative) {
      return false;
    }
  }
  return true;
};

export const rasterizePlate = (
  density: SurfacePixelDensity,
  spec: RasterPlatePrimitive
): OccupancyGrid => {
  assertLatticeInteger(spec.normalStart, 'plate.normalStart');
  assertLatticeInteger(spec.thickness, 'plate.thickness');
  if (spec.thickness <= 0) {
    throw new RangeError('plate.thickness must be greater than zero');
  }
  assertLatticeInteger(
    spec.normalStart + spec.thickness,
    'plate.normalEnd'
  );

  const vertices = shapeVertices(spec.shape);
  const minU = Math.min(...vertices.map((vertex) => vertex.u));
  const maxU = Math.max(...vertices.map((vertex) => vertex.u));
  const minV = Math.min(...vertices.map((vertex) => vertex.v));
  const maxV = Math.max(...vertices.map((vertex) => vertex.v));
  const cells: LatticePoint[] = [];

  for (let normal = spec.normalStart; normal < spec.normalStart + spec.thickness; normal += 1) {
    for (let u = minU; u < maxU; u += 1) {
      for (let v = minV; v < maxV; v += 1) {
        if (containsPoint(vertices, { u: u + 0.5, v: v + 0.5 })) {
          cells.push(pointFromPlane(spec.normalAxis, normal, { u, v }));
        }
      }
    }
  }

  return createOccupancyGrid(density, cells);
};
