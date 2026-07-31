import type { SurfacePixelDensity } from '../model';
import type {
  GeometryPartSpec,
  LatticeVec2,
  LatticeVec3,
  PartSpec,
  PlatePartSpec
} from './partContract';
import {
  createOccupancyGrid,
  parseCellKey
} from './lattice';
import { rasterizePrimitive } from './rasterize';
import type {
  Axis,
  LatticePoint,
  OccupancyGrid,
  PlanePoint,
  RasterPlatePrimitive,
  RasterPlateShape,
  RasterPrimitive
} from './types';

const point = (value: LatticeVec3): LatticePoint => ({
  x: value[0],
  y: value[1],
  z: value[2]
});

const planePoint = (value: LatticeVec2): PlanePoint => ({
  u: value[0],
  v: value[1]
});

const plateAxes = (
  plane: PlatePartSpec['plane']
): {
  normalAxis: Axis;
  normal: number;
  u: number;
  v: number;
} => {
  if (plane === 'xy') {
    return { normalAxis: 'z', normal: 2, u: 0, v: 1 };
  }
  if (plane === 'xz') {
    return { normalAxis: 'y', normal: 1, u: 0, v: 2 };
  }
  return { normalAxis: 'x', normal: 0, u: 1, v: 2 };
};

const isRectangle = (
  vertices: readonly PlanePoint[]
): boolean => {
  if (vertices.length !== 4) return false;
  const us = new Set(vertices.map((vertex) => vertex.u));
  const vs = new Set(vertices.map((vertex) => vertex.v));
  return us.size === 2 && vs.size === 2;
};

const plateShape = (
  spec: PlatePartSpec,
  uAxis: number,
  vAxis: number
): RasterPlateShape => {
  const vertices = spec.outline.map((entry) => ({
    u: spec.origin[uAxis] + entry[0],
    v: spec.origin[vAxis] + entry[1]
  }));
  if (vertices.length === 3) {
    return {
      kind: 'triangle',
      vertices: [vertices[0], vertices[1], vertices[2]]
    };
  }
  if (isRectangle(vertices)) {
    return {
      kind: 'rectangle',
      min: {
        u: Math.min(...vertices.map((vertex) => vertex.u)),
        v: Math.min(...vertices.map((vertex) => vertex.v))
      },
      max: {
        u: Math.max(...vertices.map((vertex) => vertex.u)),
        v: Math.max(...vertices.map((vertex) => vertex.v))
      }
    };
  }
  return {
    kind: 'trapezoid',
    vertices: [vertices[0], vertices[1], vertices[2], vertices[3]]
  };
};

const platePrimitive = (
  spec: PlatePartSpec
): RasterPlatePrimitive => {
  const axes = plateAxes(spec.plane);
  return {
    kind: 'plate',
    normalAxis: axes.normalAxis,
    normalStart: spec.origin[axes.normal],
    thickness: spec.thickness,
    shape: plateShape(spec, axes.u, axes.v)
  };
};

const primitiveForPart = (spec: GeometryPartSpec): RasterPrimitive => {
  switch (spec.kind) {
    case 'mass':
      return {
        kind: 'mass',
        center: point(spec.center),
        radii: point(spec.radii),
        profile: spec.profile
      };
    case 'segment':
      return {
        kind: 'segment',
        points: spec.points.map((position, index) => ({
          position: point(position),
          radii: point(spec.radii[index])
        })),
        profile: spec.profile
      };
    case 'plate':
      return platePrimitive(spec);
    case 'radial': {
      const normalIndex =
        spec.axis === 'x' ? 0 : spec.axis === 'y' ? 1 : 2;
      const planeIndexes =
        spec.axis === 'x'
          ? [1, 2] as const
          : spec.axis === 'y'
            ? [0, 2] as const
            : [0, 1] as const;
      return {
        kind: 'radial',
        normalAxis: spec.axis,
        normalStart:
          spec.center[normalIndex] - Math.floor(spec.depth / 2),
        depth: spec.depth,
        center: planePoint([
          spec.center[planeIndexes[0]],
          spec.center[planeIndexes[1]]
        ]),
        outerRadius: spec.outerRadius,
        innerRadius: spec.innerRadius
      };
    }
  }
};

const translatedGrid = (
  grid: OccupancyGrid,
  offset: LatticePoint
): OccupancyGrid =>
  createOccupancyGrid(
    grid.density,
    [...grid.cells].map((key) => {
      const cell = parseCellKey(key);
      return {
        x: cell.x + offset.x,
        y: cell.y + offset.y,
        z: cell.z + offset.z
      };
    })
  );

export const partTranslation = (spec: PartSpec): LatticePoint => {
  const attachment = spec.attachment;
  if (!attachment) return { x: 0, y: 0, z: 0 };
  return {
    x: attachment.parentAnchor[0] - attachment.partAnchor[0],
    y: attachment.parentAnchor[1] - attachment.partAnchor[1],
    z: attachment.parentAnchor[2] - attachment.partAnchor[2]
  };
};

export const rasterizePart = (
  density: SurfacePixelDensity,
  spec: GeometryPartSpec
): OccupancyGrid =>
  translatedGrid(
    rasterizePrimitive(density, primitiveForPart(spec)),
    partTranslation(spec)
  );
