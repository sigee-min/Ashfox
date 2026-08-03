import type { SurfacePixelDensity } from '../model';
import type {
  GeometryPartSpec,
  LatticeVec2,
  LatticeVec3,
  PlatePartSpec
} from './partContract';
import {
  assertDensity,
  assertLatticePoint,
  cellKey,
  comparePoints,
  createOccupancyGrid
} from './lattice';
import { partTranslation } from './partTranslation';
import type {
  Axis,
  Cuboid,
  LatticeBounds,
  LatticePoint,
  OccupancyGrid
} from './types';

const AXES: readonly Axis[] = ['x', 'y', 'z'];

type MutableBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

type PlaneAxes = Readonly<{
  normal: Axis;
  u: Axis;
  v: Axis;
}>;

type PlaneVertex = Readonly<{
  u: number;
  v: number;
}>;

const latticePoint = (value: LatticeVec3): LatticePoint => ({
  x: value[0],
  y: value[1],
  z: value[2]
});

const planeAxes = (plane: PlatePartSpec['plane']): PlaneAxes => {
  if (plane === 'xy') return { normal: 'z', u: 'x', v: 'y' };
  if (plane === 'xz') return { normal: 'y', u: 'x', v: 'z' };
  return { normal: 'x', u: 'y', v: 'z' };
};

const radialPlaneAxes = (normal: Axis): PlaneAxes => {
  if (normal === 'x') return { normal, u: 'y', v: 'z' };
  if (normal === 'y') return { normal, u: 'x', v: 'z' };
  return { normal, u: 'x', v: 'y' };
};

const cuboidFromPlane = (
  axes: PlaneAxes,
  normalMin: number,
  normalMax: number,
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number
): Cuboid => {
  const min = { x: 0, y: 0, z: 0 };
  const max = { x: 0, y: 0, z: 0 };
  min[axes.normal] = normalMin;
  max[axes.normal] = normalMax;
  min[axes.u] = uMin;
  max[axes.u] = uMax;
  min[axes.v] = vMin;
  max[axes.v] = vMax;
  return { bounds: { min, max } };
};

const compareCuboids = (left: Cuboid, right: Cuboid): number =>
  comparePoints(left.bounds.min, right.bounds.min) ||
  comparePoints(left.bounds.max, right.bounds.max);

const validBounds = (bounds: LatticeBounds): boolean =>
  bounds.min.x < bounds.max.x &&
  bounds.min.y < bounds.max.y &&
  bounds.min.z < bounds.max.z;

const intersection = (
  left: LatticeBounds,
  right: LatticeBounds
): LatticeBounds | null => {
  const bounds = {
    min: {
      x: Math.max(left.min.x, right.min.x),
      y: Math.max(left.min.y, right.min.y),
      z: Math.max(left.min.z, right.min.z)
    },
    max: {
      x: Math.min(left.max.x, right.max.x),
      y: Math.min(left.max.y, right.max.y),
      z: Math.min(left.max.z, right.max.z)
    }
  };
  return validBounds(bounds) ? bounds : null;
};

// Partitions source around cut into at most six disjoint cuboids. This is used
// only where semantic spans meet; it is not an occupancy-to-box decomposition.
const subtractBounds = (
  source: LatticeBounds,
  cut: LatticeBounds
): readonly Cuboid[] => {
  const overlap = intersection(source, cut);
  if (overlap === null) return [{ bounds: source }];

  const pieces: MutableBounds[] = [
    {
      min: source.min,
      max: { x: overlap.min.x, y: source.max.y, z: source.max.z }
    },
    {
      min: { x: overlap.max.x, y: source.min.y, z: source.min.z },
      max: source.max
    },
    {
      min: { x: overlap.min.x, y: source.min.y, z: source.min.z },
      max: { x: overlap.max.x, y: overlap.min.y, z: source.max.z }
    },
    {
      min: { x: overlap.min.x, y: overlap.max.y, z: source.min.z },
      max: { x: overlap.max.x, y: source.max.y, z: source.max.z }
    },
    {
      min: { x: overlap.min.x, y: overlap.min.y, z: source.min.z },
      max: { x: overlap.max.x, y: overlap.max.y, z: overlap.min.z }
    },
    {
      min: { x: overlap.min.x, y: overlap.min.y, z: overlap.max.z },
      max: { x: overlap.max.x, y: overlap.max.y, z: source.max.z }
    }
  ];
  return pieces.filter(validBounds).map((bounds) => ({ bounds }));
};

const mergeAlongAxis = (
  left: Cuboid,
  right: Cuboid,
  axis: Axis
): Cuboid | null => {
  const otherAxes = AXES.filter((candidate) => candidate !== axis);
  if (
    otherAxes.some(
      (other) =>
        left.bounds.min[other] !== right.bounds.min[other] ||
        left.bounds.max[other] !== right.bounds.max[other]
    )
  ) {
    return null;
  }
  if (
    left.bounds.max[axis] !== right.bounds.min[axis] &&
    right.bounds.max[axis] !== left.bounds.min[axis]
  ) {
    return null;
  }
  return {
    bounds: {
      min: {
        x: Math.min(left.bounds.min.x, right.bounds.min.x),
        y: Math.min(left.bounds.min.y, right.bounds.min.y),
        z: Math.min(left.bounds.min.z, right.bounds.min.z)
      },
      max: {
        x: Math.max(left.bounds.max.x, right.bounds.max.x),
        y: Math.max(left.bounds.max.y, right.bounds.max.y),
        z: Math.max(left.bounds.max.z, right.bounds.max.z)
      }
    }
  };
};

const mergeCompatibleCuboids = (
  input: readonly Cuboid[]
): readonly Cuboid[] => {
  const cuboids = [...input].sort(compareCuboids);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let leftIndex = 0; leftIndex < cuboids.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < cuboids.length;
        rightIndex += 1
      ) {
        for (const axis of AXES) {
          const merged = mergeAlongAxis(
            cuboids[leftIndex],
            cuboids[rightIndex],
            axis
          );
          if (merged === null) continue;
          cuboids.splice(rightIndex, 1);
          cuboids.splice(leftIndex, 1, merged);
          cuboids.sort(compareCuboids);
          changed = true;
          break outer;
        }
      }
    }
  }
  return cuboids;
};

const disjointCuboids = (input: readonly Cuboid[]): readonly Cuboid[] => {
  const accepted: Cuboid[] = [];
  for (const candidate of input) {
    let pieces: readonly Cuboid[] = [candidate];
    for (const owner of accepted) {
      pieces = pieces.flatMap((piece) =>
        subtractBounds(piece.bounds, owner.bounds)
      );
      if (pieces.length === 0) break;
    }
    accepted.push(...pieces);
  }
  return mergeCompatibleCuboids(accepted);
};

/**
 * Applies deterministic rectangular seam ownership to compiler templates.
 * This operates on cuboid bounds directly; occupancy is not used to invent
 * replacement form.
 */
export const subtractCuboidsForSeamOwnership = (
  input: readonly Cuboid[],
  owned: readonly Cuboid[]
): readonly Cuboid[] => {
  const result = input.flatMap((candidate) => {
    let pieces: readonly Cuboid[] = [candidate];
    for (const owner of owned) {
      pieces = pieces.flatMap((piece) =>
        subtractBounds(piece.bounds, owner.bounds)
      );
      if (pieces.length === 0) break;
    }
    return pieces;
  });
  return [...mergeCompatibleCuboids(result)].sort(compareCuboids);
};

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

const compileRadial = (
  spec: Extract<GeometryPartSpec, { kind: 'radial' }>
): readonly Cuboid[] => {
  const axes = radialPlaneAxes(spec.axis);
  const center = latticePoint(spec.center);
  const normalMin = center[axes.normal] - Math.floor(spec.depth / 2);
  const normalMax = normalMin + spec.depth;
  const centerU = center[axes.u];
  const centerV = center[axes.v];
  const radius = spec.outerRadius;
  const outerMinU = centerU - radius;
  const outerMaxU = centerU + radius;
  const outerMinV = centerV - radius;
  const outerMaxV = centerV + radius;

  if (spec.innerRadius > 0) {
    const inner = spec.innerRadius;
    const cornerInset = radius > 1 ? 1 : 0;
    return [
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        outerMinU + cornerInset,
        outerMaxU - cornerInset,
        outerMinV,
        centerV - inner
      ),
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        outerMinU,
        centerU - inner,
        centerV - inner,
        centerV + inner
      ),
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        centerU + inner,
        outerMaxU,
        centerV - inner,
        centerV + inner
      ),
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        outerMinU + cornerInset,
        outerMaxU - cornerInset,
        centerV + inner,
        outerMaxV
      )
    ].filter(({ bounds }) => validBounds(bounds));
  }

  if (radius === 1) {
    return [
      cuboidFromPlane(
        axes,
        normalMin,
        normalMax,
        outerMinU,
        outerMaxU,
        outerMinV,
        outerMaxV
      )
    ];
  }
  const cap = Math.max(1, Math.floor(radius / 2));
  const cornerInset = Math.max(1, Math.floor(radius / 3));
  return [
    cuboidFromPlane(
      axes,
      normalMin,
      normalMax,
      outerMinU + cornerInset,
      outerMaxU - cornerInset,
      outerMinV,
      outerMinV + cap
    ),
    cuboidFromPlane(
      axes,
      normalMin,
      normalMax,
      outerMinU,
      outerMaxU,
      outerMinV + cap,
      outerMaxV - cap
    ),
    cuboidFromPlane(
      axes,
      normalMin,
      normalMax,
      outerMinU + cornerInset,
      outerMaxU - cornerInset,
      outerMaxV - cap,
      outerMaxV
    )
  ].filter(({ bounds }) => validBounds(bounds));
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
