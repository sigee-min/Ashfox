import type { SurfacePixelDensity } from '../../model';
import type {
  GeometryPartSpec,
  LatticeVec2
} from '../part';
import {
  assertDensity,
  assertLatticePoint,
  cellKey,
  createOccupancyGrid
} from '../lattice';
import { partTranslation } from '../part/translate';
import {
  compareCuboids,
  disjointCuboids,
  mergeCompatibleCuboids,
  validBounds
} from './operations';
import { cuboidFromPlane, latticePoint, planeAxes } from './plane';
import { compileRadial } from './radial';
import type {
  Axis,
  Cuboid,
  LatticeBounds,
  LatticePoint,
  OccupancyGrid
} from '../contract';

const AXES: readonly Axis[] = ['x', 'y', 'z'];

type MutableBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

type PlaneVertex = Readonly<{
  u: number;
  v: number;
}>;

export { subtractCuboidsForSeamOwnership } from './operations';

const translatedCuboids = (
  cuboids: readonly Cuboid[],
  offset: LatticePoint
): readonly Cuboid[] =>
  cuboids.map(({ bounds }) => ({
    bounds: {
      min: {
        x: bounds.min.x + offset.x,
        y: bounds.min.y + offset.y,
        z: bounds.min.z + offset.z
      },
      max: {
        x: bounds.max.x + offset.x,
        y: bounds.max.y + offset.y,
        z: bounds.max.z + offset.z
      }
    }
  }));

const dominantAxis = (point: LatticePoint): Axis =>
  AXES.reduce((best, axis) =>
    point[axis] > point[best] ? axis : best
  );

const insetForProfile = (
  extent: number,
  profile: 'soft' | 'balanced' | 'hard'
): number => {
  if (profile === 'hard') return 0;
  if (extent <= 2) return 0;
  const divisor = profile === 'soft' ? 3 : 4;
  return Math.min(
    Math.max(1, Math.floor(extent / divisor)),
    Math.floor((extent - 1) / 2)
  );
};

const compileMass = (
  spec: Extract<GeometryPartSpec, { kind: 'mass' }>
): readonly Cuboid[] => {
  const center = latticePoint(spec.center);
  const radii = latticePoint(spec.radii);
  const full: LatticeBounds = {
    min: {
      x: center.x - radii.x,
      y: center.y - radii.y,
      z: center.z - radii.z
    },
    max: {
      x: center.x + radii.x,
      y: center.y + radii.y,
      z: center.z + radii.z
    }
  };
  if (spec.profile === 'block') return [{ bounds: full }];
  const profile = spec.profile;

  const axis = dominantAxis(radii);
  const extent = full.max[axis] - full.min[axis];
  if (extent < 3) return [{ bounds: full }];
  const cap = Math.max(1, Math.floor(extent / 4));
  if (cap * 2 >= extent) return [{ bounds: full }];

  const endBounds = (min: number, max: number): LatticeBounds => {
    const bounds: MutableBounds = {
      min: { ...full.min },
      max: { ...full.max }
    };
    bounds.min[axis] = min;
    bounds.max[axis] = max;
    for (const other of AXES) {
      if (other === axis) continue;
      const otherExtent = full.max[other] - full.min[other];
      const inset = insetForProfile(otherExtent, profile);
      bounds.min[other] += inset;
      bounds.max[other] -= inset;
    }
    return bounds;
  };

  return mergeCompatibleCuboids([
    { bounds: endBounds(full.min[axis], full.min[axis] + cap) },
    {
      bounds: {
        min: { ...full.min, [axis]: full.min[axis] + cap },
        max: { ...full.max, [axis]: full.max[axis] - cap }
      } as LatticeBounds
    },
    { bounds: endBounds(full.max[axis] - cap, full.max[axis]) }
  ]);
};

const segmentBounds = (
  startPosition: LatticePoint,
  startRadii: LatticePoint,
  endPosition: LatticePoint,
  endRadii: LatticePoint
): Cuboid => ({
  bounds: {
    min: {
      x: Math.min(
        startPosition.x - startRadii.x,
        endPosition.x - endRadii.x
      ),
      y: Math.min(
        startPosition.y - startRadii.y,
        endPosition.y - endRadii.y
      ),
      z: Math.min(
        startPosition.z - startRadii.z,
        endPosition.z - endRadii.z
      )
    },
    max: {
      x: Math.max(
        startPosition.x + startRadii.x,
        endPosition.x + endRadii.x
      ),
      y: Math.max(
        startPosition.y + startRadii.y,
        endPosition.y + endRadii.y
      ),
      z: Math.max(
        startPosition.z + startRadii.z,
        endPosition.z + endRadii.z
      )
    }
  }
});

const samePoint = (left: LatticePoint, right: LatticePoint): boolean =>
  AXES.every((axis) => left[axis] === right[axis]);

const pathMidpoint = (
  left: LatticePoint,
  right: LatticePoint
): LatticePoint => ({
  x: left.x + Math.trunc((right.x - left.x) / 2),
  y: left.y + Math.trunc((right.y - left.y) / 2),
  z: left.z + Math.trunc((right.z - left.z) / 2)
});

const radiusMidpoint = (
  left: LatticePoint,
  right: LatticePoint
): LatticePoint => ({
  x: Math.round((left.x + right.x) / 2),
  y: Math.round((left.y + right.y) / 2),
  z: Math.round((left.z + right.z) / 2)
});

const compileSegment = (
  spec: Extract<GeometryPartSpec, { kind: 'segment' }>
): readonly Cuboid[] => {
  const cuboids: Cuboid[] = [];
  for (let index = 1; index < spec.points.length; index += 1) {
    const startPosition = latticePoint(spec.points[index - 1]);
    const endPosition = latticePoint(spec.points[index]);
    const startRadii = latticePoint(spec.radii[index - 1]);
    const endRadii = latticePoint(spec.radii[index]);
    const delta = {
      x: Math.abs(endPosition.x - startPosition.x),
      y: Math.abs(endPosition.y - startPosition.y),
      z: Math.abs(endPosition.z - startPosition.z)
    };
    const hasTaper = !samePoint(startRadii, endRadii);
    if (!hasTaper || delta[dominantAxis(delta)] < 2) {
      cuboids.push(
        segmentBounds(startPosition, startRadii, endPosition, endRadii)
      );
      continue;
    }
    const middlePosition = pathMidpoint(startPosition, endPosition);
    const middleRadii = radiusMidpoint(startRadii, endRadii);
    cuboids.push(
      segmentBounds(startPosition, startRadii, middlePosition, middleRadii),
      segmentBounds(middlePosition, middleRadii, endPosition, endRadii)
    );
  }
  return disjointCuboids(cuboids);
};

const rectangleOutline = (outline: readonly LatticeVec2[]): boolean =>
  outline.length === 4 &&
  new Set(outline.map((entry) => entry[0])).size === 2 &&
  new Set(outline.map((entry) => entry[1])).size === 2;

const polygonCrossRange = (
  vertices: readonly PlaneVertex[],
  sweep: 'u' | 'v',
  sample: number
): readonly [number, number] | null => {
  const cross = sweep === 'u' ? 'v' : 'u';
  const intersections: number[] = [];
  vertices.forEach((start, index) => {
    const end = vertices[(index + 1) % vertices.length];
    const low = Math.min(start[sweep], end[sweep]);
    const high = Math.max(start[sweep], end[sweep]);
    if (sample < low || sample > high) return;
    if (start[sweep] === end[sweep]) {
      intersections.push(start[cross], end[cross]);
      return;
    }
    const t = (sample - start[sweep]) / (end[sweep] - start[sweep]);
    intersections.push(start[cross] + (end[cross] - start[cross]) * t);
  });
  if (intersections.length < 2) return null;
  return [Math.min(...intersections), Math.max(...intersections)];
};

const compilePlate = (
  spec: Extract<GeometryPartSpec, { kind: 'plate' }>
): readonly Cuboid[] => {
  const axes = planeAxes(spec.plane);
  const origin = latticePoint(spec.origin);
  const vertices = spec.outline.map((entry) => ({
    u: origin[axes.u] + entry[0],
    v: origin[axes.v] + entry[1]
  }));
  const minU = Math.min(...vertices.map((vertex) => vertex.u));
  const maxU = Math.max(...vertices.map((vertex) => vertex.u));
  const minV = Math.min(...vertices.map((vertex) => vertex.v));
  const maxV = Math.max(...vertices.map((vertex) => vertex.v));
  const normalMin = origin[axes.normal];
  const normalMax = normalMin + spec.thickness;

  if (rectangleOutline(spec.outline)) {
    return [
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        minU,
        maxU,
        minV,
        maxV
      )
    ];
  }

  const sweep: 'u' | 'v' = maxU - minU > maxV - minV ? 'u' : 'v';
  const sweepMin = sweep === 'u' ? minU : minV;
  const sweepMax = sweep === 'u' ? maxU : maxV;
  const sweepExtent = sweepMax - sweepMin;
  const bandCount = Math.max(1, Math.min(4, sweepExtent));
  const cuboids: Cuboid[] = [];
  for (let index = 0; index < bandCount; index += 1) {
    const bandMin = sweepMin + Math.floor((index * sweepExtent) / bandCount);
    const bandMax =
      sweepMin + Math.floor(((index + 1) * sweepExtent) / bandCount);
    if (bandMin >= bandMax) continue;
    const crossRange = polygonCrossRange(
      vertices,
      sweep,
      (bandMin + bandMax) / 2
    );
    if (crossRange === null) continue;
    const crossMin = Math.floor(crossRange[0]);
    const crossMax = Math.ceil(crossRange[1]);
    if (crossMin >= crossMax) continue;
    const uMin = sweep === 'u' ? bandMin : crossMin;
    const uMax = sweep === 'u' ? bandMax : crossMax;
    const vMin = sweep === 'v' ? bandMin : crossMin;
    const vMax = sweep === 'v' ? bandMax : crossMax;
    cuboids.push(
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        uMin,
        uMax,
        vMin,
        vMax
      )
    );
  }
  // Uniform bands deliberately simplify broad polygon areas. Preserve sharp
  // interior turns with a one-cell semantic accent so wing tips, fins, and
  // similar attachment landmarks are not averaged out of the silhouette.
  const accents = vertices.flatMap((vertex): readonly Cuboid[] => {
    const position = vertex[sweep];
    if (position <= sweepMin || position >= sweepMax) return [];
    const crossRange = polygonCrossRange(vertices, sweep, position);
    if (crossRange === null) return [];
    const crossMin = Math.floor(crossRange[0]);
    const crossMax = Math.ceil(crossRange[1]);
    if (crossMin >= crossMax) return [];
    const bandMin = Math.floor(position);
    const bandMax = bandMin + 1;
    return [cuboidFromPlane(
      axes,
      normalMin,
      normalMax,
      sweep === 'u' ? bandMin : crossMin,
      sweep === 'u' ? bandMax : crossMax,
      sweep === 'v' ? bandMin : crossMin,
      sweep === 'v' ? bandMax : crossMax
    )];
  });
  if (cuboids.length === 0) {
    return [
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        minU,
        maxU,
        minV,
        maxV
      )
    ];
  }
  return disjointCuboids([...cuboids, ...accents]);
};

/**
 * Compiles one normalized semantic geometry part directly into a small set of
 * density-1 lattice cuboids. Attachment translation is included in the output.
 */
export const compileSemanticPartCuboids = (
  spec: GeometryPartSpec
): readonly Cuboid[] => {
  const local = (() => {
    switch (spec.kind) {
      case 'mass':
        return compileMass(spec);
      case 'segment':
        return compileSegment(spec);
      case 'plate':
        return compilePlate(spec);
      case 'radial':
        return compileRadial(spec);
    }
  })();
  return [...translatedCuboids(local, partTranslation(spec))].sort(
    compareCuboids
  );
};

/** Expands templates for collision/contact validation and rejects overlaps. */
export const occupancyForCuboids = (
  cuboids: readonly Cuboid[],
  density: SurfacePixelDensity = 1
): OccupancyGrid => {
  assertDensity(density);
  const cells: LatticePoint[] = [];
  const occupied = new Set<string>();
  for (const [index, cuboid] of [...cuboids].sort(compareCuboids).entries()) {
    assertLatticePoint(cuboid.bounds.min, `cuboids[${index}].bounds.min`);
    assertLatticePoint(cuboid.bounds.max, `cuboids[${index}].bounds.max`);
    if (!validBounds(cuboid.bounds)) {
      throw new RangeError(`cuboids[${index}] must have positive extent`);
    }
    for (let x = cuboid.bounds.min.x; x < cuboid.bounds.max.x; x += 1) {
      for (let y = cuboid.bounds.min.y; y < cuboid.bounds.max.y; y += 1) {
        for (let z = cuboid.bounds.min.z; z < cuboid.bounds.max.z; z += 1) {
          const point = { x, y, z };
          const key = cellKey(point);
          if (occupied.has(key)) {
            throw new RangeError(`cuboids overlap at lattice cell ${key}`);
          }
          occupied.add(key);
          cells.push(point);
        }
      }
    }
  }
  return createOccupancyGrid(density, cells);
};

/** Expands a selected form only for collision, contact, and surface checks. */
export const validationOccupancyForPart = (
  spec: GeometryPartSpec,
  density: SurfacePixelDensity
): OccupancyGrid =>
  occupancyForCuboids(compileSemanticPartCuboids(spec), density);
