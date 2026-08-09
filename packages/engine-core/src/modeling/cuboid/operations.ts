import { comparePoints } from '../lattice';
import type { Axis, Cuboid, LatticeBounds } from '../contract';

const AXES: readonly Axis[] = ['x', 'y', 'z'];

type MutableBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export const compareCuboids = (left: Cuboid, right: Cuboid): number =>
  comparePoints(left.bounds.min, right.bounds.min) ||
  comparePoints(left.bounds.max, right.bounds.max);

export const validBounds = (bounds: LatticeBounds): boolean =>
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

export const mergeCompatibleCuboids = (
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

export const disjointCuboids = (
  input: readonly Cuboid[]
): readonly Cuboid[] => {
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

/** Applies deterministic rectangular seam ownership to compiler templates. */
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
